// App Store and Google Play badge components

export function AppStoreBadge({ isDarkMode }) {
  return (
    <svg width="140" height="42" viewBox="0 0 140 42" xmlns="http://www.w3.org/2000/svg">
      <rect width="140" height="42" rx="6" fill={isDarkMode ? '#333' : '#000'} />
      {/* Apple Logo */}
      <g transform="translate(10, 8)">
        <path
          d="M18.5 8.5c-0.1-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.7-1.3-0.1-2.5 0.8-3.2 0.8-0.7 0-1.7-0.7-2.8-0.7-1.5 0-2.8 0.8-3.6 2.1-1.5 2.6-0.4 6.5 1.1 8.7 0.7 1 1.6 2.2 2.7 2.1 1.1 0 1.5-0.7 2.8-0.7 1.3 0 1.7 0.7 2.8 0.7 1.2 0 2-1 2.7-2 0.8-1.2 1.2-2.3 1.2-2.4 0 0-2.3-0.9-2.3-3.5 0-2.2 1.8-3.2 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7"
          fill="white"
        />
        <path
          d="M15.5 2.5c0.6-0.7 1-1.7 0.9-2.7-0.9 0-1.9 0.6-2.5 1.3-0.6 0.6-1 1.6-0.9 2.6 1 0.1 1.9-0.5 2.5-1.2"
          fill="white"
        />
      </g>
      {/* Text */}
      <text x="36" y="15" fill="white" fontSize="8" fontFamily="system-ui, -apple-system, sans-serif">Download on the</text>
      <text x="36" y="30" fill="white" fontSize="14" fontWeight="600" fontFamily="system-ui, -apple-system, sans-serif">App Store</text>
    </svg>
  );
}

export function GooglePlayBadge({ isDarkMode }) {
  return (
    <svg width="156" height="42" viewBox="0 0 156 42" xmlns="http://www.w3.org/2000/svg">
      <rect width="156" height="42" rx="6" fill={isDarkMode ? '#333' : '#000'} />
      {/* Google Play Icon */}
      <g transform="translate(10, 8)">
        {/* Play triangle */}
        <path d="M4 2L18 13L4 24V2Z" fill="#00D4FF" />
        <path d="M4 2L13 13L4 24V2Z" fill="#00F076" />
        <path d="M4 13L13 13L4 24V13Z" fill="#FFDA00" />
        <path d="M4 2L13 13L4 13V2Z" fill="#FF3A44" />
      </g>
      {/* Text */}
      <text x="36" y="15" fill="white" fontSize="8" fontFamily="system-ui, -apple-system, sans-serif">GET IT ON</text>
      <text x="36" y="30" fill="white" fontSize="14" fontWeight="600" fontFamily="system-ui, -apple-system, sans-serif">Google Play</text>
    </svg>
  );
}
