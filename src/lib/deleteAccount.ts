export function requestDeleteAccount(userId: string) {
  localStorage.setItem(
    `delete_${userId}`,
    JSON.stringify({
      at: Date.now(),
      status: "pending",
    })
  );
}
