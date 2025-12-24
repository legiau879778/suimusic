export function isLicenseValid(params: {
  issuedEpoch: number;
  expireEpoch: number;
  currentEpoch: number;
}) {
  if (params.expireEpoch === 0) return true;
  return params.currentEpoch < params.expireEpoch;
}
