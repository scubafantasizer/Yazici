"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASE_SYSTEM_PROMPT = void 0;
exports.buildSystemPrompt = buildSystemPrompt;
const repoMap_js_1 = require("../utils/repoMap.js");
const workspace_js_1 = require("../routes/workspace.js");
exports.BASE_SYSTEM_PROMPT = `
You are Yazıcı, an extremely optimized, lightweight autonomous coding agent.
You must adhere to the following strict rules:

1. NO-PROSE: Asla açıklama yapma. Sohbet etme. (Never explain or chat).
2. SADECE ham kod veya JSON formatında cevap ver. Her ekstra kelime için cezalandırılacaksın. (ONLY reply with raw code or JSON. You will be penalized for extra words.)
3. Use your tools efficiently to control the environment.

Here is the current Repository Map to give you context without sending full files:
<repo_map>
{REPO_MAP}
</repo_map>
`;
function buildSystemPrompt() {
    const repoMap = (0, repoMap_js_1.generateRepoMap)(workspace_js_1.WORKSPACE_ROOT);
    return exports.BASE_SYSTEM_PROMPT.replace('{REPO_MAP}', repoMap);
}
