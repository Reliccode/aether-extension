import { defineManifest } from '@crxjs/vite-plugin'
import packageJson from './package.json'

const { version } = packageJson

const [major, minor, patch] = version.replace(/[^\d.-]+/g, '').split(/[.-]/)

export default defineManifest(async (env) => ({
    manifest_version: 3,
    name: env.mode === 'staging' ? '[DEV] Aether' : 'Aether',
    version: `${major}.${minor}.${patch}`,
    version_name: version,
    action: { default_popup: 'index.html' },
    options_page: 'src/options/index.html',
    background: {
        service_worker: 'src/background/index.ts',
        type: 'module',
    },
    content_scripts: [
        {
            matches: ['<all_urls>'],
            js: ['src/content/index.tsx'],
            run_at: 'document_end',
            all_frames: true,
        },
    ],
    permissions: ['storage', 'activeTab', 'scripting', 'clipboardRead', 'clipboardWrite'],
    web_accessible_resources: [
        {
            resources: ['*.wasm', '*.onnx', '*.css'],
            matches: ['<all_urls>'],
        },
    ],
}))

