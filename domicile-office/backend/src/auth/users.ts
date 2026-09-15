export interface UserAccount {
  id: number;
  username: string;
  password_hash: string;
  role: string;
  department: string;
  is_active: boolean;
}

// In-memory operator account store for Domicile Office prototype
const USERS: UserAccount[] = [
  {
    id: 1,
    username: 'dom_officer_01',
    password_hash: 'scrypt$16384$8$1$582cdfc4a9e882ad0657ce8f540fe2e6$2c6f5110e582e928cd09f256ced69248d9f4195138012102d71e990412f5b84cba7ed906625c979f910133bfaed98eb2161f502fe8bcacea08a1668c22eb653d',
    role: 'REVIEW_OFFICER',
    department: 'domicile',
    is_active: true
  },
  {
    id: 2,
    username: 'dom_admin_01',
    password_hash: 'scrypt$16384$8$1$edb7c11e76d1a61c5f20e704338fe62f$c31bbc4525a3a55c5f57075e912b08e9657d52fc094c1b42b2de22dde9ce331c5645a57db008dfdac71440b6fab70ba7f4c5579eacdb2f60b859f5546e484ef3',
    role: 'ADMIN',
    department: 'domicile',
    is_active: true
  }
];

let customUserFinder: ((username: string) => Promise<UserAccount | null>) | null = null;

export function setUserFinder(fn: ((username: string) => Promise<UserAccount | null>) | null): void {
  customUserFinder = fn;
}

export async function findUserByUsername(username: string): Promise<UserAccount | null> {
  if (!username || typeof username !== 'string') {
    return null;
  }

  if (customUserFinder) {
    return customUserFinder(username);
  }

  const found = USERS.find(u => u.username === username.trim());
  return found ? { ...found } : null;
}
