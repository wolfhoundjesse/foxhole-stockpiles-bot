import { cyan, yellow, red, green, gray } from 'colorette'

export const Logger = {
  debug: (context: string, message: string, data?: any) => {
    if (process.env.DEBUG !== 'true') return
    console.log(
      `${gray('[')}${cyan(new Date().toISOString())}${gray(']')} ${yellow(context)} ${message}`,
      data ? `\n${gray('Data:')} ${JSON.stringify(data, null, 2)}` : '',
    )
  },

  error: (context: string, message: string, error?: any) => {
    console.error(
      `${gray('[')}${cyan(new Date().toISOString())}${gray(']')} ${red('ERROR')} ${yellow(context)} ${message}`,
      error ? `\n${gray('Error:')} ${error.stack || error}` : '',
    )
  },

  success: (context: string, message: string) => {
    if (process.env.DEBUG !== 'true') return
    console.log(
      `${gray('[')}${cyan(new Date().toISOString())}${gray(']')} ${green('SUCCESS')} ${yellow(context)} ${message}`,
    )
  },
}
