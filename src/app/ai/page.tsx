"use client";

import { useState } from 'react';
import styles from '@/styles/ai.module.css';
import { useAuth } from '@/context/AuthContext';
import { useModal } from '@/context/ModalContext';
import { getMembershipEntitlements } from '@/lib/membershipStore';
import { saveRedirect } from '@/lib/redirect';

export default function AIGeneratorPage() {
  const [prompt, setPrompt] = useState('');
  const [genre, setGenre] = useState('pop');
  const [customGenre, setCustomGenre] = useState('');
  const [language, setLanguage] = useState('English');
  const [lyrics, setLyrics] = useState('');
  const [loading, setLoading] = useState(false);

  const { user } = useAuth();
  const { openLogin, openPermission } = useModal();

  // Check membership entitlements
  const ent = getMembershipEntitlements(user?.membership || null);
  const hasAccess = user?.role === 'admin' || ent.canUseAI;

  const generateLyrics = async () => {
    if (!prompt.trim()) return;

    setLoading(true);
    try {
      const finalGenre = genre === 'other' ? customGenre : genre;
      const response = await fetch('/api/ai/generate-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, genre: finalGenre, language }),
      });

      const data = await response.json();
      if (data.lyrics) {
        setLyrics(data.lyrics);
      } else {
        alert('Failed to generate lyrics');
      }
    } catch (error) {
      console.error(error);
      alert('Error generating lyrics');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      {!hasAccess ? (
        <div className={styles.accessDenied}>
          <h1>Premium Feature</h1>
          <p>This AI music generator requires a membership to access.</p>
          <p>Please upgrade your membership to use this feature.</p>
          <button 
            className={styles.upgradeBtn}
            onClick={() => {
              if (!user) {
                saveRedirect();
                openLogin();
              } else {
                // Redirect to profile/membership tab
                window.location.href = '/profile?tab=membership';
              }
            }}
          >
            {!user ? 'Login to Upgrade' : 'Upgrade Membership'}
          </button>
        </div>
      ) : (
        <>
          <div className={styles.form}>
            <h1 className={styles.formTitle}>AI Music Lyrics Generator</h1>
            <p className={styles.formDescription}>Generate creative song lyrics using AI</p>

            <div className={styles.field}>
              <label>Prompt:</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the theme, mood, or story for your song..."
                rows={4}
              />
            </div>

            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label>Genre:</label>
                <select value={genre} onChange={(e) => setGenre(e.target.value)}>
                  <option value="pop">Pop</option>
                  <option value="rock">Rock</option>
                  <option value="hip-hop">Hip-Hop/Rap</option>
                  <option value="electronic">Electronic/Dance</option>
                  <option value="jazz">Jazz</option>
                  <option value="classical">Classical</option>
                  <option value="country">Country</option>
                  <option value="r&b">R&B/Soul</option>
                  <option value="reggae">Reggae</option>
                  <option value="folk">Folk</option>
                  <option value="alternative">Alternative</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className={styles.field}>
                <label>Language:</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                  <option value="Italian">Italian</option>
                  <option value="Vietnamese">Vietnamese</option>
                </select>
              </div>
            </div>

            {genre === 'other' && (
              <div className={styles.field}>
                <label>Custom Genre:</label>
                <input
                  type="text"
                  value={customGenre}
                  onChange={(e) => setCustomGenre(e.target.value)}
                  placeholder="Enter your custom genre..."
                />
              </div>
            )}

            <div className={styles.generateSection}>
              <button className={styles.generateBtn} onClick={generateLyrics} disabled={loading || !prompt.trim()}>
                {loading ? 'Generating...' : 'Generate Lyrics'}
              </button>
            </div>
          </div>

          {lyrics && (
            <div className={styles.result}>
              <h2>Generated Lyrics:</h2>
              <pre>{lyrics}</pre>
              <button className={styles.copyBtn} onClick={() => navigator.clipboard.writeText(lyrics)}>
                Copy to Clipboard
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}