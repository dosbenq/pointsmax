import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

const config: Config = {
    darkMode: ['class'],
    content: {
    relative: true,
    files: [
      './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
      './src/components/**/*.{js,ts,jsx,tsx,mdx}',
      './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    ],
  },
  theme: {
  		extend: {
  		fontFamily: {
  			sans: [
  				'var(--font-geist-sans)',
  				'system-ui',
  				'sans-serif'
  			],
  			mono: [
  				'var(--font-geist-mono)',
  				'system-ui',
  				'sans-serif'
  			]
  		},
      fontSize: {
        display: ['3rem', { lineHeight: '1.1', fontWeight: '650' }],
        title: ['1.5rem', { lineHeight: '1.3', fontWeight: '600' }],
        heading: ['1.125rem', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        caption: ['0.875rem', { lineHeight: '1.5', fontWeight: '500' }],
      },
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			},
  			// PointsMax semantic colors (dark mode aware)
  			'pm-bg': 'rgb(var(--pm-bg-rgb) / <alpha-value>)',
  			'pm-surface': 'rgb(var(--pm-surface-rgb) / <alpha-value>)',
  			'pm-surface-soft': 'var(--pm-surface-soft)',
  			'pm-surface-raised': 'var(--pm-surface-raised)',
  			'pm-border': 'var(--pm-border)',
  			'pm-border-strong': 'var(--pm-border-strong)',
  			'pm-accent-border': 'var(--pm-accent-border)',
  			'pm-accent-glow': 'var(--pm-accent-glow)',
  			'pm-ink': {
  				900: 'var(--pm-ink-900)',
  				700: 'var(--pm-ink-700)',
  				500: 'var(--pm-ink-500)',
  			},
  			'pm-accent': {
  				DEFAULT: 'var(--pm-accent)',
  				strong: 'var(--pm-accent-strong)',
  				soft: 'var(--pm-accent-soft)',
  			},
  			'pm-success': 'var(--pm-success)',
  			'pm-success-soft': 'var(--pm-success-soft)',
  			'pm-success-border': 'var(--pm-success-border)',
  			'pm-warning': 'var(--pm-warning)',
  			'pm-warning-soft': 'var(--pm-warning-soft)',
  			'pm-warning-border': 'var(--pm-warning-border)',
  			'pm-danger': 'var(--pm-danger)',
  			'pm-danger-soft': 'var(--pm-danger-soft)',
  			'pm-danger-border': 'var(--pm-danger-border)',
  		},
  		boxShadow: {
  			'glow': 'var(--pm-shadow-glow)',
  		}
  	}
  },
  plugins: [tailwindcssAnimate],
}

export default config
