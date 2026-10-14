// Display names of the Inventory items the tests create. The owner's format:
//   AAG / RSAG / FCI items:  <type>-<last two octets of the host IP>      e.g. AAG-38.76
//   Server instances:        WS<year>-SQL<year>-<last two octets>          e.g. WS2022-SQL2025-19.145
// The Director limits a Display name to 25 characters; a longer name is refused here so the test ends with a clear message.

const MAX_LENGTH = 25;

// "10.10.38.76" -> "38.76". A host that is not an IPv4 address (a DNS name) falls back to its first label.
export function hostSuffix(host: string): string {
  const octets = host.trim().match(/(\d{1,3}\.\d{1,3})$/);
  return octets ? octets[1] : host.trim().split('.')[0];
}

function checked(name: string): string {
  if (name.length > MAX_LENGTH) throw new Error(`The Display name "${name}" is longer than ${MAX_LENGTH} characters`);
  return name;
}

export function groupItemName(type: 'AAG' | 'RSAG' | 'FCI', host: string): string {
  return checked(`${type}-${hostSuffix(host)}`);
}

// osLabel is for example "WS2022", sqlLabel for example "SQL2025".
export function instanceItemName(osLabel: string, sqlLabel: string, host: string): string {
  return checked(`${osLabel}-${sqlLabel}-${hostSuffix(host)}`);
}

// The variants the tests need next to the main name: renamed (-e) and rejected duplicate (-d). Both stay within 25 characters
// for any IPv4 suffix because the longest main name is 22 characters.
export const editedName = (name: string): string => checked(`${name}-e`);
export const duplicateName = (name: string): string => checked(`${name}-d`);
