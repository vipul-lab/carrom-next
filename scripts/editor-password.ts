/**
 * Generates one `EDITORS` entry: `npm run editor -- someone@example.com`
 *
 * Prints `email:salt:hash`. Append it to EDITORS in .env.local (comma separated
 * between entries) and restart the server. The password itself is never stored.
 */


import { hashPassword } from '../src/lib/password'

/**
 * Reads one line without echoing it, so the password never appears on screen
 * or in the shell's scrollback.
 *
 * Raw mode is the only reliable way to suppress the echo on a real terminal,
 * but it does not exist when stdin is a pipe — so piped input (handy for
 * scripting and for testing this script) falls back to a plain read.
 */
/**
 * Piped stdin can only be drained once, so when there is no terminal we read
 * the whole of it up front and hand out lines from the queue.
 */
let pipedLines: string[] | null = null

async function readPipedLines(): Promise<string[]> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks).toString('utf8').split(/\r?\n/)
}

/**
 * Reads one line without echoing it, so the password never appears on screen
 * or in the shell's scrollback.
 *
 * Raw mode is the only reliable way to suppress the echo on a real terminal,
 * but it does not exist when stdin is a pipe — so piped input (handy for
 * scripting, and for testing this script) falls back to the queue above.
 */
async function askHidden(question: string): Promise<string> {
  process.stdout.write(question)

  if (!process.stdin.isTTY) {
    pipedLines ??= await readPipedLines()
    process.stdout.write('\n')
    return pipedLines.shift() ?? ''
  }

  return new Promise((resolve) => {
    const stdin = process.stdin
    let answer = ''

    stdin.setRawMode(true)
    stdin.resume()
    stdin.setEncoding('utf8')

    const done = (value: string) => {
      stdin.setRawMode(false)
      stdin.pause()
      stdin.removeListener('data', onData)
      process.stdout.write('\n')
      resolve(value)
    }

    const onData = (chunk: string) => {
      for (const char of chunk) {
        if (char === '\n' || char === '\r') return done(answer)
        if (char === '\u0003') {
          // Ctrl-C
          process.stdout.write('\n')
          process.exit(130)
        }
        if (char === '\u007f' || char === '\b') {
          answer = answer.slice(0, -1)
        } else if (char >= ' ') {
          answer += char
        }
      }
    }

    stdin.on('data', onData)
  })
}

async function main() {
  const email = process.argv[2]?.trim().toLowerCase()

  if (!email || !email.includes('@')) {
    console.error('Usage: npm run editor -- someone@example.com')
    process.exit(1)
  }

  const password = await askHidden(`Password for ${email}: `)

  if (password.length < 8) {
    console.error('\nPassword must be at least 8 characters.')
    process.exit(1)
  }

  const confirm = await askHidden('Confirm password: ')

  if (password !== confirm) {
    console.error('\nPasswords did not match.')
    process.exit(1)
  }

  const { salt, hash } = await hashPassword(password)

  console.log('\nAdd this to EDITORS in .env.local (comma separated between editors):\n')
  console.log(`${email}:${salt}:${hash}\n`)
}

main()
