#!/usr/bin/env node
import {execFileSync, spawnSync} from 'node:child_process'
import {createInterface} from 'node:readline/promises'
import {cpSync, existsSync, mkdirSync, readFileSync, writeFileSync} from 'node:fs'
import {dirname, join, resolve} from 'node:path'
import {randomBytes} from 'node:crypto'
import {fileURLToPath} from 'node:url'

const args = process.argv.slice(2)
const command = args[0]
const provider = args[1]
const flags = new Set(args.filter((arg) => arg.startsWith('--')))
const targetArg = args.find((arg, index) => index > 1 && !arg.startsWith('--'))
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const rl = createInterface({input: process.stdin, output: process.stdout})

const colors = {
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
}

try {
  if (command !== 'setup' || !['r2', 's3'].includes(provider || '')) usage(command ? 1 : 0)

  if (provider === 'r2' && !flags.has('--template-only')) {
    await setupR2(resolve(targetArg || 'remote-files-r2-worker'))
  } else {
    scaffoldTemplate(provider, resolve(targetArg || `remote-files-${provider === 'r2' ? 'r2-worker' : 's3-api'}`))
  }
} finally {
  rl.close()
}

function usage(code = 0) {
  console.log('Usage:')
  console.log('  sanity-plugin-remote-files setup r2 [target-directory]')
  console.log('  sanity-plugin-remote-files setup r2 [target-directory] --template-only')
  console.log('  sanity-plugin-remote-files setup s3 [target-directory]')
  process.exit(code)
}

async function setupR2(target) {
  title('Cloudflare R2 Setup')
  const wrangler = resolveWrangler()

  step(1, 'Cloudflare Authentication')
  if (canRun(wrangler, ['whoami'])) {
    warn('Currently logged in:')
    console.log(capture(wrangler, ['whoami']).split('\n').slice(0, 20).join('\n'))
    if (await confirm('Logout and re-authenticate?', false)) {
      run(wrangler, ['logout'], {label: 'Logging out'})
      success('Logged out')
    }
  }

  if (!canRun(wrangler, ['whoami'])) {
    console.log('Opening browser for Cloudflare login...')
    run(wrangler, ['login'])
    if (!canRun(wrangler, ['whoami'])) fail('Authentication failed')
  }

  const listCheck = capture(wrangler, ['r2', 'bucket', 'list'], {allowFailure: true})
  if (!process.env.CLOUDFLARE_ACCOUNT_ID && listCheck.includes('More than one account available')) {
    warn('Multiple accounts detected')
    const accounts = listCheck.split('\n').filter((line) => line.includes('`')).map((line) => line.trim().replaceAll('`', ''))
    const selected = await choose('Choose account:', accounts.length ? accounts : ['Enter account id manually'])
    const id = selected.match(/[a-f0-9]{32}/)?.[0] || await input('Cloudflare account id:')
    process.env.CLOUDFLARE_ACCOUNT_ID = id
    success(`Using account ${id}`)
  }
  success('Authenticated')

  step(2, 'R2 Bucket')
  let bucketName = await input('Bucket name:', 'sanity-remote-files')
  let skipCreation = false
  let bucketList = capture(wrangler, ['r2', 'bucket', 'list'], {allowFailure: true})

  if (bucketExists(bucketList, bucketName)) {
    const bucketInfo = capture(wrangler, ['r2', 'bucket', 'info', bucketName], {allowFailure: true})
    const location = getValue(bucketInfo, 'location') || 'unknown'
    warn(`Bucket '${bucketName}' already exists (Location: ${location})`)
    const choice = await choose('What would you like to do?', [
      `Use existing bucket (keep ${location})`,
      'Delete and recreate (choose new location)',
      'Enter different bucket name',
    ])

    if (choice.startsWith('Use existing')) {
      skipCreation = true
      success(`Using existing bucket in ${location}`)
    } else if (choice.startsWith('Delete')) {
      if (!(await confirm(`Delete bucket '${bucketName}'? This cannot be undone.`, false))) fail('Cancelled')
      run(wrangler, ['r2', 'bucket', 'delete', bucketName], {label: 'Deleting bucket'})
      for (let attempt = 1; attempt <= 3; attempt++) {
        await sleep(2000)
        bucketList = capture(wrangler, ['r2', 'bucket', 'list'], {allowFailure: true})
        if (!bucketExists(bucketList, bucketName)) break
        warn(`Still deleting... (attempt ${attempt}/3)`)
      }
      if (bucketExists(bucketList, bucketName)) fail('Failed to delete bucket. Please delete it manually and retry.')
    } else {
      bucketName = await input('New bucket name:', 'my-sanity-media')
    }
  }

  bucketList = capture(wrangler, ['r2', 'bucket', 'list'], {allowFailure: true})
  if (!skipCreation && !bucketExists(bucketList, bucketName)) {
    const location = await choose('Select bucket location:', [
      'wnam - Western North America',
      'enam - Eastern North America',
      'weur - Western Europe',
      'eeur - Eastern Europe',
      'apac - Asia Pacific',
      'oc - Oceania',
    ])
    const locationCode = location.split(' ')[0]
    run(wrangler, ['r2', 'bucket', 'create', bucketName, `--location=${locationCode}`], {label: `Creating bucket in ${locationCode}`})
    const createdLocation = getValue(capture(wrangler, ['r2', 'bucket', 'info', bucketName], {allowFailure: true}), 'location') || locationCode
    if (createdLocation.toLowerCase() !== locationCode.toLowerCase()) warn(`Location mismatch: selected ${locationCode}, got ${createdLocation}`)
    success(`Bucket '${bucketName}' created in ${createdLocation}`)
  }

  step(3, 'Public Access')
  let publicUrl = ''
  const access = await choose('Expose bucket via:', [
    'r2.dev - Quick development URL',
    'custom - Your own domain',
    'both - r2.dev + custom domain',
    'skip - Configure manually later',
  ])

  if (access.includes('r2.dev') || access.startsWith('both')) {
    run(wrangler, ['r2', 'bucket', 'dev-url', 'enable', bucketName], {allowFailure: true})
    const devUrlOutput = capture(wrangler, ['r2', 'bucket', 'dev-url', 'get', bucketName], {allowFailure: true})
    publicUrl = devUrlOutput.match(/https:\/\/[^\s]+\.r2\.dev/)?.[0] || await input('Enter r2.dev URL:', 'https://pub-xxxxx.r2.dev')
    success(`r2.dev: ${publicUrl}`)
  }

  if (access.startsWith('custom') || access.startsWith('both')) {
    const domain = await input('Custom domain:', 'cdn.example.com')
    if (domain) {
      warn(`Need Cloudflare Zone ID for ${domain}`)
      const zoneId = await input('Zone ID:')
      if (zoneId) {
        const result = spawnWrangler(wrangler, ['r2', 'bucket', 'domain', 'add', bucketName, `--domain=${domain}`, `--zone-id=${zoneId}`, '--force'])
        if (result.status === 0) {
          publicUrl = `https://${domain}`
          success(`Custom domain: ${publicUrl}`)
          console.log(dim(`DNS: CNAME ${domain} -> ${bucketName}.r2.cloudflarestorage.com`))
        } else {
          warn('Custom domain failed. Configure it manually in Cloudflare if needed.')
        }
      }
    }
  }

  if (!publicUrl) {
    warn('No public URL set')
    publicUrl = await input('Public URL:', 'https://pub-xxxxx.r2.dev')
  }

  step(4, 'Worker Configuration')
  if (existsSync(target)) {
    const overwrite = await confirm(`Target '${target}' exists. Copy template files into it?`, true)
    if (!overwrite) fail('Cancelled')
  }
  scaffoldTemplate('r2', target, {quiet: true})

  const defaultWorker = `${bucketName}-sanity-remote-files`
  const workerName = await input('Worker name:', defaultWorker)
  const workerList = capture(wrangler, ['worker', 'list'], {allowFailure: true})
  if (workerList.includes(workerName)) {
    warn(`Worker '${workerName}' may already exist`)
    if (!(await confirm('Deploy over it?', true))) fail('Cancelled')
  }

  const origins = await input('Allowed origins (comma-separated):', 'http://localhost:3333')
  const uploadPrefix = await input('Upload prefix:', 'uploads')
  const wranglerToml = join(target, 'wrangler.toml')
  writeWorkerConfig(wranglerToml, {bucketName, publicUrl, workerName, origins, uploadPrefix})
  success(`Config: worker=${workerName}, bucket=${bucketName}`)

  const authSecret = randomBytes(32).toString('hex')
  run(wrangler, ['--config', wranglerToml, 'secret', 'put', 'REMOTE_FILES_SECRET'], {input: authSecret, label: 'Saving Worker secret'})

  step(5, 'Deploy Worker')
  const deploy = capture(wrangler, ['--config', wranglerToml, 'deploy'], {cwd: target})
  console.log(deploy)
  const workerUrl = deploy.match(/https:\/\/[^\s]+\.workers\.dev/)?.[0] || await input('Worker URL:', `https://${workerName}.workers.dev`)
  success(`Deployed: ${workerUrl}`)

  console.log('')
  console.log(`${colors.green}${colors.bold}Setup complete${colors.reset}`)
  console.log('')
  console.log(bold('Add to your Sanity config:'))
  console.log(`cloudflareR2Provider({`)
  console.log(`  id: 'r2',`)
  console.log(`  endpoint: process.env.SANITY_STUDIO_R2_ENDPOINT!,`)
  console.log(`  publicUrl: process.env.SANITY_STUDIO_R2_PUBLIC_URL,`)
  console.log(`  uploadPrefix: '${uploadPrefix}',`)
  console.log(`  headers: {authorization: \`Bearer \${process.env.SANITY_STUDIO_R2_TOKEN}\`},`)
  console.log(`})`)
  console.log('')
  console.log(bold('Values:'))
  console.log(`  SANITY_STUDIO_R2_ENDPOINT=${workerUrl}`)
  console.log(`  SANITY_STUDIO_R2_PUBLIC_URL=${publicUrl}`)
  console.log(`  SANITY_STUDIO_R2_TOKEN=${authSecret}`)
  console.log('')
}

function scaffoldTemplate(providerName, target, options = {}) {
  const template = providerName === 'r2' ? 'cloudflare-r2-worker' : 's3-express'
  const source = join(root, 'templates', template)

  if (!existsSync(source)) fail(`Template not found: ${source}`)
  mkdirSync(target, {recursive: true})
  cpSync(source, target, {recursive: true, force: true})

  if (!options.quiet) {
    console.log(`Created ${providerName === 'r2' ? 'Cloudflare R2 Worker' : 'S3 API'} template at ${target}`)
    console.log('Next steps:')
    if (providerName === 'r2') {
      console.log('1. cd ' + target)
      console.log('2. npm install')
      console.log('3. Edit wrangler.toml bucket_name, PUBLIC_URL, ALLOWED_ORIGINS, and UPLOAD_PREFIX')
      console.log('4. Optional: wrangler secret put REMOTE_FILES_SECRET')
      console.log('5. npm run deploy')
    } else {
      console.log('1. cd ' + target)
      console.log('2. npm install')
      console.log('3. Set AWS_REGION, AWS_BUCKET, PUBLIC_URL, and AWS credentials')
      console.log('4. Optional: set REMOTE_FILES_SECRET')
      console.log('5. npm run dev or deploy the API to your host')
    }
  }
}

function resolveWrangler() {
  if (commandExists('wrangler')) return {cmd: 'wrangler', prefix: []}
  return {cmd: 'npx', prefix: ['-y', 'wrangler@latest']}
}

function commandExists(name) {
  try {
    execFileSync('which', [name], {stdio: 'ignore'})
    return true
  } catch {
    return false
  }
}

function spawnWrangler(wrangler, args, options = {}) {
  return spawnSync(wrangler.cmd, [...wrangler.prefix, ...args], {
    cwd: options.cwd,
    encoding: 'utf8',
    input: options.input,
    stdio: options.input ? ['pipe', 'inherit', 'inherit'] : 'inherit',
    env: process.env,
  })
}

function run(wrangler, args, options = {}) {
  if (options.label) console.log(dim(options.label + '...'))
  const result = spawnWrangler(wrangler, args, options)
  if (result.status !== 0 && !options.allowFailure) fail(`Command failed: ${[wrangler.cmd, ...wrangler.prefix, ...args].join(' ')}`)
  return result
}

function capture(wrangler, args, options = {}) {
  const result = spawnSync(wrangler.cmd, [...wrangler.prefix, ...args], {
    cwd: options.cwd,
    encoding: 'utf8',
    env: process.env,
  })
  const output = `${result.stdout || ''}${result.stderr || ''}`
  if (result.status !== 0 && !options.allowFailure) fail(output || `Command failed: ${args.join(' ')}`)
  return output
}

function canRun(wrangler, args) {
  return spawnSync(wrangler.cmd, [...wrangler.prefix, ...args], {stdio: 'ignore', env: process.env}).status === 0
}

async function input(label, defaultValue = '') {
  const answer = await rl.question(`${label}${defaultValue ? ` (${defaultValue})` : ''} `)
  return answer.trim() || defaultValue
}

async function confirm(label, defaultValue = true) {
  const suffix = defaultValue ? 'Y/n' : 'y/N'
  const answer = (await rl.question(`${label} [${suffix}] `)).trim().toLowerCase()
  if (!answer) return defaultValue
  return ['y', 'yes'].includes(answer)
}

async function choose(label, options) {
  console.log(label)
  options.forEach((option, index) => console.log(`  ${index + 1}. ${option}`))
  while (true) {
    const answer = await input('Choose:', '1')
    const index = Number(answer) - 1
    if (options[index]) return options[index]
  }
}

function writeWorkerConfig(path, values) {
  const next = readFileSync(path, 'utf8')
    .replace(/^name = .*/m, `name = "${values.workerName}"`)
    .replace(/^bucket_name = .*/m, `bucket_name = "${values.bucketName}"`)
    .replace(/^PUBLIC_URL = .*/m, `PUBLIC_URL = "${values.publicUrl}"`)
    .replace(/^ALLOWED_ORIGINS = .*/m, `ALLOWED_ORIGINS = "${values.origins}"`)
    .replace(/^UPLOAD_PREFIX = .*/m, `UPLOAD_PREFIX = "${values.uploadPrefix}"`)
  writeFileSync(path, next)
}

function bucketExists(output, bucketName) {
  return new RegExp(`name:\\s*${escapeRegExp(bucketName)}(\\s|$)`).test(output) || output.includes(`"name":"${bucketName}"`)
}

function getValue(output, key) {
  return output.split('\n').find((line) => line.toLowerCase().startsWith(`${key.toLowerCase()}:`))?.split(':').slice(1).join(':').trim().replaceAll(',', '')
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function title(text) {
  console.log('')
  console.log(`${colors.bold}${colors.cyan}${text}${colors.reset}`)
}

function step(number, text) {
  console.log('')
  console.log(`${colors.bold}${colors.cyan}Step ${number} - ${text}${colors.reset}`)
}

function success(text) {
  console.log(`${colors.green}✓ ${text}${colors.reset}`)
}

function warn(text) {
  console.log(`${colors.yellow}! ${text}${colors.reset}`)
}

function fail(text) {
  console.error(`${colors.red}✗ ${text}${colors.reset}`)
  process.exit(1)
}

function bold(text) {
  return `${colors.bold}${text}${colors.reset}`
}

function dim(text) {
  return `${colors.dim}${text}${colors.reset}`
}
