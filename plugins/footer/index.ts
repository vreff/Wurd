import type { DeterministicPlugin } from '../../src/plugins.js'

/**
 * Footer plugin — deterministic, uses finalize() to render after references.
 *
 * Usage:
 *   [plugin:footer]
 *   github: https://github.com/username
 *   twitter: https://twitter.com/username
 *   linkedin: https://linkedin.com/in/username
 *   website: https://example.com
 *   email: mailto:you@example.com
 *   [/plugin]
 *
 * Each line is "platform: url". Supported platforms:
 *   github, twitter/x, linkedin, website/link, email, youtube, mastodon, bluesky
 *
 * The inline render() call is a no-op — the footer is emitted via finalize()
 * so it always appears below the references section.
 */

interface SocialLink {
  platform: string
  url: string
  icon: string
  label: string
}

const ICONS: Record<string, { icon: string; label: string }> = {
  github: {
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/></svg>`,
    label: 'GitHub',
  },
  twitter: {
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
    label: 'X',
  },
  x: {
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
    label: 'X',
  },
  linkedin: {
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`,
    label: 'LinkedIn',
  },
  youtube: {
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`,
    label: 'YouTube',
  },
  mastodon: {
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M23.268 5.313c-.35-2.578-2.617-4.61-5.304-5.004C17.51.242 15.792 0 11.813 0h-.03c-3.98 0-4.835.242-5.288.309C3.882.692 1.496 2.518.917 5.127.64 6.412.61 7.837.661 9.143c.074 1.874.088 3.745.26 5.611.118 1.24.325 2.47.62 3.68.55 2.237 2.777 4.098 4.96 4.857 2.336.792 4.849.923 7.256.38.265-.061.527-.132.786-.213.585-.184 1.27-.39 1.774-.753a.057.057 0 00.023-.043v-1.809a.052.052 0 00-.02-.041.053.053 0 00-.046-.01 20.282 20.282 0 01-4.709.547c-2.73 0-3.463-1.284-3.674-1.818a5.593 5.593 0 01-.319-1.433.053.053 0 01.066-.054 19.648 19.648 0 004.636.544c.568 0 1.135-.015 1.7-.044 2.733-.14 5.007-.727 5.263-.852 1.614-.788 3.031-2.36 3.172-7.026.006-.2.042-2.108.042-2.315 0-.706.26-5.003-.084-6.497z"/></svg>`,
    label: 'Mastodon',
  },
  bluesky: {
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.785 2.627 3.59 3.501 6.204 3.254-3.666.628-6.875 2.152-4.388 6.748 2.87 4.516 5.476.812 7.56-2.537.388-.623.596-1.082.596-1.082s.208.459.596 1.082c2.084 3.349 4.69 7.053 7.56 2.537 2.487-4.596-.722-6.12-4.388-6.748 2.615.247 5.42-.627 6.204-3.254.246-.829.624-5.789.624-6.478 0-.69-.139-1.861-.902-2.206-.659-.298-1.664-.62-4.3 1.24C13.046 4.747 11.087 8.686 12 10.8z"/></svg>`,
    label: 'Bluesky',
  },
  website: {
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    label: 'Website',
  },
  link: {
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    label: 'Website',
  },
  email: {
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
    label: 'Email',
  },
}

const DEFAULT_ICON = {
  icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
  label: 'Link',
}

function parseLinks(content: string): SocialLink[] {
  const links: SocialLink[] = []
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue

    const platform = trimmed.slice(0, colonIdx).trim().toLowerCase()
    const url = trimmed.slice(colonIdx + 1).trim()
    if (!url) continue

    const entry = ICONS[platform] || DEFAULT_ICON
    links.push({
      platform,
      url,
      icon: entry.icon,
      label: ICONS[platform] ? entry.label : platform,
    })
  }
  return links
}

let storedContent: string | null = null

function reset() {
  storedContent = null
}

const plugin: DeterministicPlugin = {
  name: 'footer',
  mode: 'deterministic',

  layoutHints: {
    spanKey: 'footer',
    defaultSpan: 'all',
    marginTop: 0,
    marginBottom: 0,
  },

  finalizeLayoutHints: {
    spanKey: 'footer',
    defaultSpan: 'all',
    marginTop: 48,
    marginBottom: 0,
  },

  assets: {
    css: `
    .plugin-footer {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 40px 0 32px;
      border-top: 1px solid rgba(255,255,255,0.08);
    }
    .plugin-footer-links {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
    }
    .plugin-footer-link {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 8px 14px;
      border-radius: 8px;
      color: rgba(255,255,255,0.5);
      text-decoration: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 13px;
      font-weight: 500;
      letter-spacing: 0.01em;
      transition: color 0.2s, background 0.2s;
    }
    .plugin-footer-link:hover {
      color: rgba(255,255,255,0.9);
      background: rgba(255,255,255,0.06);
    }
    .plugin-footer-link svg {
      display: block;
      flex-shrink: 0;
    }
    `,
  },

  // Inline render is a no-op — we store the content and emit via finalize()
  render(content: string, _id: string): string {
    storedContent = content
    return ''
  },

  finalize(): string | null {
    if (!storedContent) return null
    const links = parseLinks(storedContent)
    reset()
    if (links.length === 0) return null

    const items = links.map(l =>
      `<a class="plugin-footer-link" href="${escapeAttr(l.url)}" target="_blank" rel="noopener noreferrer">${l.icon}<span>${escapeHtml(l.label)}</span></a>`
    ).join('\n      ')

    return `<div class="plugin-footer">
      <div class="plugin-footer-links">
        ${items}
      </div>
    </div>`
  },
}

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export default plugin
