"use client";

import { useEffect, useState } from "react";
import styles from "@/styles/profile.module.css";
import { useAuth } from "@/context/AuthContext";
import { loadProfile, saveProfile } from "@/lib/profileStore";
import {
  requestDelete,
  cancelDelete,
  getDeleteStatus,
} from "@/lib/accountStore";

export default function SettingsPanel() {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState<any>({});
  const [pendingDelete, setPendingDelete] =
    useState<any>(null);

  useEffect(() => {
    if (!user) return;
    setProfile(loadProfile(user.id));
    setPendingDelete(getDeleteStatus(user.id));
  }, [user]);

  if (!user) return null;

  function saveSocials() {
    saveProfile(user.id, profile);
  }

  return (
    <div className={styles.card}>
      <h2>Cài đặt</h2>

      {/* ===== SOCIAL LINKS ===== */}
      <section className={styles.settingSection}>
        <h3>Mạng xã hội</h3>

        <div className={styles.socialGrid}>
          <div className={styles.socialField}>
            <label>
              <i className="fa-brands fa-x-twitter" />
              Twitter / X
            </label>
            <input
              placeholder="https://x.com/username"
              value={profile.socials?.twitter || ""}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  socials: {
                    ...profile.socials,
                    twitter: e.target.value,
                  },
                })
              }
            />
          </div>

          <div className={styles.socialField}>
            <label>
              <i className="fa-brands fa-facebook" />
              Facebook
            </label>
            <input
              placeholder="https://facebook.com/username"
              value={profile.socials?.facebook || ""}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  socials: {
                    ...profile.socials,
                    facebook: e.target.value,
                  },
                })
              }
            />
          </div>

          <div className={styles.socialField}>
            <label>
              <i className="fa-brands fa-instagram" />
              Instagram
            </label>
            <input
              placeholder="https://instagram.com/username"
              value={profile.socials?.instagram || ""}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  socials: {
                    ...profile.socials,
                    instagram: e.target.value,
                  },
                })
              }
            />
          </div>

          <div className={styles.socialField}>
            <label>
              <i className="fa-solid fa-globe" />
              Website
            </label>
            <input
              placeholder="https://yourwebsite.com"
              value={profile.socials?.website || ""}
              onChange={(e) =>
                setProfile({
                  ...profile,
                  socials: {
                    ...profile.socials,
                    website: e.target.value,
                  },
                })
              }
            />
          </div>
        </div>

        <button
          className={styles.primaryBtn}
          onClick={saveSocials}
        >
          Lưu mạng xã hội
        </button>
      </section>

      {/* ===== DELETE ACCOUNT ===== */}
      <section className={styles.settingSection}>
        <h3>Nguy hiểm</h3>

        {!pendingDelete ? (
          <button
            className={styles.dangerBtn}
            onClick={() => {
              requestDelete(user.id);
              setPendingDelete({ at: Date.now() });
            }}
          >
            Xóa tài khoản
          </button>
        ) : (
          <div className={styles.pendingDelete}>
            <p>⚠️ Tài khoản sẽ bị xóa sau 24h.</p>
            <button
              onClick={() => {
                cancelDelete(user.id);
                setPendingDelete(null);
              }}
            >
              Hủy xóa
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
