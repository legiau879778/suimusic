export default function ProfileMembership() {
  return (
    <>
      <h2>Membership music Copyright Mode</h2>

      <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
        {[
          "Artist Membership",
          "Creator Membership",
          "Business Membership",
          "AI Platform Membership",
        ].map((m) => (
          <div
            key={m}
            style={{
              flex: 1,
              padding: 24,
              borderRadius: 24,
              background:
                "linear-gradient(180deg, rgba(59,130,246,.25), rgba(30,64,175,.25))",
            }}
          >
            <h4>{m}</h4>
            <button style={{ marginTop: 12 }}>
              XÁC NHẬN
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
