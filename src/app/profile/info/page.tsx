import { useSession } from "next-auth/react";
import { getActiveAdminWallet } from "@/lib/adminWalletStore";
import { getCurrentUser } from "@/lib/authStore";

export default function ProfileInfo() {
  const { data } = useSession();
  const user = getCurrentUser();
  const wallet = user
    ? getActiveAdminWallet(user.email)
    : null;

  return (
    <>
      <h2>Thông tin cá nhân</h2>

      <div style={{ display: "flex", gap: 24 }}>
        <div style={{ flex: 1 }}>
          {["Họ và tên", "Email", "Quốc gia", "SĐT"].map(
            (f) => (
              <input
                key={f}
                placeholder={f}
                style={{
                  width: "100%",
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 12,
                }}
              />
            )
          )}
        </div>

        <div style={{ flex: 1 }}>
          <h4>Số địa chỉ Blockchain</h4>
          <p>{wallet?.address || "Chưa kết nối"}</p>
        </div>
      </div>
    </>
  );
}
