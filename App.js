import 'react-native-url-polyfill/auto';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './src/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

async function completeAuthFromUrl(url) {
  const parsedUrl = new URL(url);
  const code = parsedUrl.searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  const fragment = new URLSearchParams(parsedUrl.hash.slice(1));
  const accessToken = fragment.get('access_token');
  const refreshToken = fragment.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    if (error) throw error;
  }
}

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [snippets, setSnippets] = useState([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    let active = true;
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) setSession(nextSession);
    });
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (active) {
        setSession(currentSession);
        setLoading(false);
      }
    });

    const initialUrl = Linking.getInitialURL();
    initialUrl.then((url) => url && completeAuthFromUrl(url).catch((authError) => setError(authError.message)));
    const linkListener = Linking.addEventListener('url', ({ url }) => {
      completeAuthFromUrl(url).catch((authError) => setError(authError.message));
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
      linkListener.remove();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setSnippets([]);
      return undefined;
    }

    let active = true;
    const loadSnippets = async () => {
      const { data, error: queryError } = await supabase
        .from('snippets')
        .select('id, title, content, updated_at')
        .order('updated_at', { ascending: false });
      if (active) {
        if (queryError) setError(queryError.message);
        else setSnippets(data ?? []);
      }
    };
    loadSnippets();
    const channel = supabase
      .channel('snippets-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'snippets' }, loadSnippets)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  const signIn = async () => {
    setBusy(true);
    setError('');
    try {
      const redirectTo = Linking.createURL('auth/callback');
      const { data, error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (authError) throw authError;
      if (!data.url) throw new Error('Supabase did not return an authorization URL.');

      if (Platform.OS === 'web') {
        window.location.assign(data.url);
      } else {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
        if (result.type === 'success') await completeAuthFromUrl(result.url);
      }
    } catch (authError) {
      setError(authError.message);
      setBusy(false);
    }
  };

  const addSnippet = async () => {
    if (!title.trim() || !content.trim()) return;
    setBusy(true);
    setError('');
    const { error: insertError } = await supabase.from('snippets').insert({
      user_id: session.user.id,
      title: title.trim(),
      content: content.trim(),
    });
    if (insertError) setError(insertError.message);
    else {
      setTitle('');
      setContent('');
    }
    setBusy(false);
  };

  const signOut = async () => {
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ALPHA BUSINESS CONCEPTS</Text>
          <Text style={styles.heading}>{session ? 'Your workspace' : 'Business, moving forward.'}</Text>
        </View>
        {loading ? (
          <ActivityIndicator color="#087E78" size="large" />
        ) : session ? (
          <>
            <View style={styles.accountRow}>
              <View style={styles.accountCopy}>
                <Text style={styles.accountName}>{session.user.user_metadata?.full_name || 'Welcome'}</Text>
                <Text style={styles.accountEmail}>{session.user.email}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={signOut} style={styles.textButton}>
                <Text style={styles.textButtonLabel}>Sign out</Text>
              </Pressable>
            </View>
            <Text style={styles.sectionTitle}>Shared snippets</Text>
            <TextInput
              accessibilityLabel="Snippet title"
              onChangeText={setTitle}
              placeholder="Title"
              placeholderTextColor="#75817E"
              style={styles.input}
              value={title}
            />
            <TextInput
              accessibilityLabel="Snippet content"
              multiline
              onChangeText={setContent}
              placeholder="Write a useful note..."
              placeholderTextColor="#75817E"
              style={[styles.input, styles.multiline]}
              value={content}
            />
            <Pressable accessibilityRole="button" disabled={busy} onPress={addSnippet} style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>{busy ? 'Please wait...' : 'Add snippet'}</Text>
            </Pressable>
            <FlatList
              data={snippets}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={<Text style={styles.empty}>No snippets yet.</Text>}
              renderItem={({ item }) => (
                <View style={styles.snippet}>
                  <Text style={styles.snippetTitle}>{item.title}</Text>
                  <Text style={styles.snippetContent}>{item.content}</Text>
                </View>
              )}
              style={styles.list}
            />
          </>
        ) : (
          <View style={styles.login}>
            <Text style={styles.intro}>Practical support for building a stronger, more sustainable business.</Text>
            <Pressable accessibilityRole="button" disabled={busy} onPress={signIn} style={styles.primaryButton}>
              <Text style={styles.primaryButtonLabel}>{busy ? 'Opening Google...' : 'Continue with Google'}</Text>
            </Pressable>
          </View>
        )}
        {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F4F6F1' },
  container: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center', padding: 24 },
  header: { paddingTop: 36, paddingBottom: 40 },
  eyebrow: { color: '#087E78', fontSize: 12, fontWeight: '700' },
  heading: { color: '#17352F', fontSize: 32, fontWeight: '700', marginTop: 14 },
  login: { flex: 1, justifyContent: 'center', paddingBottom: 100 },
  intro: { color: '#52635E', fontSize: 18, lineHeight: 28, marginBottom: 28, maxWidth: 430 },
  primaryButton: { backgroundColor: '#087E78', borderRadius: 6, alignItems: 'center', paddingVertical: 15, paddingHorizontal: 18 },
  primaryButtonLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  accountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 34 },
  accountCopy: { flexShrink: 1, paddingRight: 12 },
  accountName: { color: '#17352F', fontSize: 18, fontWeight: '700' },
  accountEmail: { color: '#52635E', fontSize: 14, marginTop: 4 },
  textButton: { padding: 8 },
  textButtonLabel: { color: '#087E78', fontWeight: '700' },
  sectionTitle: { color: '#17352F', fontSize: 20, fontWeight: '700', marginBottom: 14 },
  input: { backgroundColor: '#FFFFFF', borderColor: '#D9E0DA', borderRadius: 5, borderWidth: 1, color: '#17352F', fontSize: 16, padding: 13, marginBottom: 10 },
  multiline: { minHeight: 88, textAlignVertical: 'top' },
  list: { marginTop: 20 },
  snippet: { borderTopColor: '#D9E0DA', borderTopWidth: 1, paddingVertical: 16 },
  snippetTitle: { color: '#17352F', fontSize: 16, fontWeight: '700' },
  snippetContent: { color: '#52635E', fontSize: 15, lineHeight: 22, marginTop: 6 },
  empty: { color: '#75817E', paddingVertical: 20 },
  error: { backgroundColor: '#FCE8E5', color: '#922E24', padding: 12, marginTop: 14, borderRadius: 4 },
});
