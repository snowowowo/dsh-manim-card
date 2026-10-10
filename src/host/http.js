// 这条 HTTP 路由上的两个小工具：答 JSON、读 JSON 请求体。
//
// 单独一份是因为「答 JSON」被 ./pyodide.js 与 ./environment.js 都要用，
// 而「读请求体」里的限额、流式读取、空体这几点写错都很隐蔽（空体当 `{}`、
// 超限先读完再拒 = 白读一遍），所以只写一份、只测一份。

/** 请求体上限：这条路由只收一个包名数组，给足余量即可，别让一个请求占满内存。 */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * 「这是请求的错，不是路由的错」。
 *
 * 为什么要单独一类：坏正文（截断的 JSON、超限）此前落到路由的统一 catch 里，被答成 **500**——
 * 那是把客户端的错说成服务端的故障（客户端会去重试 / 用户会看到「插件坏了」），
 * 而且顺带把整段堆栈打进日志。分开之后调用方按类判状态码，客户端错误只回 400 不吵日志。
 */
export class BadRequest extends Error {}

/** 答一段 JSON。 */
export function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload ?? null));
}

/**
 * 读一个 JSON 请求体。空体回 `{}`（没有参数与「参数是空对象」是同一件事，不必让调用方分两种情况）。
 * @returns 解析后的值。
 * @throws {BadRequest} 不是 JSON 或超限（调用方据此答 400）。
 */
export async function readJsonBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.byteLength;
    if (size > MAX_BODY_BYTES) throw new BadRequest(`请求体超过 ${MAX_BODY_BYTES} 字节`);
    chunks.push(buffer);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    // 原文不进消息：它可能是一段二进制，塞进 JSON 里回给客户端只会更难读
    throw new BadRequest('请求体不是合法 JSON');
  }
}
