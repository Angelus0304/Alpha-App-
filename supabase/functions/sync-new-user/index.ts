import { importPKCS8, SignJWT } from 'npm:jose@5.9.6';

const jsonHeaders = { 'content-type': 'application/json' };

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const webhookSecret = Deno.env.get('SHEETS_WEBHOOK_SECRET');
  if (!webhookSecret || request.headers.get('x-webhook-secret') !== webhookSecret) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const event = await request.json();
    if (event.type !== 'INSERT' || event.schema !== 'auth' || event.table !== 'users' || !event.record?.id) {
      return new Response(JSON.stringify({ ignored: true }), { headers: jsonHeaders });
    }

    const serviceAccount = JSON.parse(Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') ?? '{}');
    const spreadsheetId = Deno.env.get('GOOGLE_SPREADSHEET_ID');
    const sheetName = Deno.env.get('GOOGLE_SHEET_NAME') ?? 'Users';
    if (!serviceAccount.client_email || !serviceAccount.private_key || !spreadsheetId) {
      throw new Error('Google Sheets service account and spreadsheet secrets must be configured.');
    }

    const now = Math.floor(Date.now() / 1000);
    const signingKey = await importPKCS8(serviceAccount.private_key, 'RS256');
    const assertion = await new SignJWT({ scope: 'https://www.googleapis.com/auth/spreadsheets' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuer(serviceAccount.client_email)
      .setAudience('https://oauth2.googleapis.com/token')
      .setIssuedAt(now)
      .setExpirationTime(now + 3600)
      .sign(signingKey);

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion,
      }),
    });
    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok) throw new Error(tokenPayload.error_description ?? 'Google token request failed.');

    const user = event.record;
    const metadata = user.raw_user_meta_data ?? {};
    const range = `${sheetName}!A:A`;
    const encodedRange = encodeURIComponent(range);
    const baseUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values`;
    const lookupResponse = await fetch(`${baseUrl}/${encodedRange}`, {
      headers: { authorization: `Bearer ${tokenPayload.access_token}` },
    });
    const lookupPayload = await lookupResponse.json();
    if (!lookupResponse.ok) throw new Error(lookupPayload.error?.message ?? 'Google Sheets lookup failed.');
    if ((lookupPayload.values ?? []).some((row: string[]) => row[0] === user.id)) {
      return new Response(JSON.stringify({ alreadySynced: true }), { headers: jsonHeaders });
    }

    const appendResponse = await fetch(
      `${baseUrl}/${encodeURIComponent(`${sheetName}!A:E`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${tokenPayload.access_token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          values: [[
            user.id,
            user.email ?? '',
            metadata.full_name ?? metadata.name ?? '',
            metadata.avatar_url ?? '',
            user.created_at ?? '',
          ]],
        }),
      },
    );
    const appendPayload = await appendResponse.json();
    if (!appendResponse.ok) throw new Error(appendPayload.error?.message ?? 'Google Sheets append failed.');

    return new Response(JSON.stringify({ synced: true }), { headers: jsonHeaders });
  } catch (error) {
    console.error('User-to-Sheets sync failed:', error);
    return new Response(JSON.stringify({ error: 'User sync failed.' }), { status: 500, headers: jsonHeaders });
  }
});