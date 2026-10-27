// The icons a person can choose for their account. Stored in user.image as "icon:<key>".
// (People who sign in with Google or Microsoft start with their own photo URL.)
export const AVATARS = [
	{ key: 'fox', emoji: '🦊', label: 'Fox', bg: '#fed7aa' },
	{ key: 'panda', emoji: '🐼', label: 'Panda', bg: '#e5e7eb' },
	{ key: 'owl', emoji: '🦉', label: 'Owl', bg: '#e7d5c0' },
	{ key: 'cat', emoji: '🐱', label: 'Cat', bg: '#fde68a' },
	{ key: 'dog', emoji: '🐶', label: 'Dog', bg: '#fcd9b6' },
	{ key: 'rabbit', emoji: '🐰', label: 'Rabbit', bg: '#fbcfe8' },
	{ key: 'bear', emoji: '🐻', label: 'Bear', bg: '#e8c9a8' },
	{ key: 'penguin', emoji: '🐧', label: 'Penguin', bg: '#bfdbfe' },
	{ key: 'frog', emoji: '🐸', label: 'Frog', bg: '#bbf7d0' },
	{ key: 'turtle', emoji: '🐢', label: 'Turtle', bg: '#a7f3d0' },
	{ key: 'butterfly', emoji: '🦋', label: 'Butterfly', bg: '#c7d2fe' },
	{ key: 'bee', emoji: '🐝', label: 'Bee', bg: '#fef08a' },
	{ key: 'whale', emoji: '🐳', label: 'Whale', bg: '#a5f3fc' },
	{ key: 'sunflower', emoji: '🌻', label: 'Sunflower', bg: '#fde047' },
	{ key: 'maple', emoji: '🍁', label: 'Maple leaf', bg: '#fecaca' },
	{ key: 'tree', emoji: '🌲', label: 'Evergreen', bg: '#bbf7d0' },
	{ key: 'apple', emoji: '🍎', label: 'Apple', bg: '#fecdd3' },
	{ key: 'carrot', emoji: '🥕', label: 'Carrot', bg: '#fed7aa' },
	{ key: 'bread', emoji: '🍞', label: 'Bread', bg: '#fde8c8' },
	{ key: 'star', emoji: '⭐', label: 'Star', bg: '#fef3c7' },
	{ key: 'sun', emoji: '☀️', label: 'Sun', bg: '#fde68a' },
	{ key: 'heart', emoji: '💙', label: 'Heart', bg: '#dbeafe' }
] as const;

export const AVATAR_KEYS: string[] = AVATARS.map((a) => a.key);

export const avatarValue = (key: string) => `icon:${key}`;

/** The icon for a stored image value, or null when it is a photo URL or empty. */
export function avatarFor(image: string | null | undefined) {
	if (!image?.startsWith('icon:')) return null;
	return AVATARS.find((a) => a.key === image.slice(5)) ?? null;
}
