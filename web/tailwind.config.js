export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Misma paleta que crm/ (café tierra + verde planta, estilo landing
        // nkuvo.com) para consistencia de marca entre subdominios de NKUVO.
        hrm: {
          primary:                '#2E6B30',
          'on-primary':           '#FFFFFF',
          'primary-container':    '#D7F0D0',
          'on-primary-container': '#0B2008',
          secondary:              '#7A5230',
          'on-secondary':         '#FFFFFF',
          'secondary-container':  '#FFDCBE',
          'on-secondary-container': '#2B1700',
          tertiary:               '#96490F',
          'on-tertiary':          '#FFFFFF',
          'tertiary-container':   '#FFDBC8',
          'on-tertiary-container': '#331200',
          surface:                '#FBF9F4',
          'on-surface':           '#1C1B16',
          'surface-variant':      '#E7E2D4',
          'on-surface-variant':   '#4A4739',
          'surface-container-low': '#F5F3EC',
          'surface-container':    '#EFEDE4',
          'surface-container-high': '#E9E7DD',
          outline:                '#7B7768',
          'outline-variant':      '#CCC7B5',
          error:                  '#BA1A1A',
          'on-error':             '#FFFFFF',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
        '4xl': '28px',
      },
      boxShadow: {
        'md3-1': '0px 1px 2px rgba(0,0,0,0.18), 0px 1px 3px 1px rgba(0,0,0,0.10)',
        'md3-2': '0px 1px 2px rgba(0,0,0,0.18), 0px 2px 6px 2px rgba(0,0,0,0.10)',
        'md3-3': '0px 4px 8px 3px rgba(0,0,0,0.10), 0px 1px 3px rgba(0,0,0,0.18)',
        'md3-4': '0px 6px 10px 4px rgba(0,0,0,0.10), 0px 2px 3px rgba(0,0,0,0.18)',
        'md3-5': '0px 8px 12px 6px rgba(0,0,0,0.10), 0px 4px 4px rgba(0,0,0,0.18)',
      }
    }
  },
  plugins: []
}
