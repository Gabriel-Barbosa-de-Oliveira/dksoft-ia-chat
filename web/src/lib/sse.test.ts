import { test } from "node:test";
import assert from "node:assert/strict";
import { createSseDecoder, type SseFrame } from "./sse.ts";
import { chunk, streamOk, streamOkCrlf } from "./__fixtures__/stream.ts";

function decodeAll(parts: string[]): SseFrame[] {
  const d = createSseDecoder();
  return [...parts.flatMap((p) => d.feed(p)), ...d.flush()];
}

test("decodifica o fluxo completo", () => {
  const frames = decodeAll([streamOk]);
  assert.deepEqual(
    frames.map((f) => f.event),
    ["meta", "tool", "tool", "token", "token", "token", "done"],
  );
  assert.equal(JSON.parse(frames[3]!.data).text, "O aluno ");
});

test("o resultado não depende de onde o texto é partido", () => {
  const expected = decodeAll([streamOk]);
  for (let size = 1; size <= 40; size++) {
    assert.deepEqual(decodeAll(chunk(streamOk, size)), expected, `pedaços de ${size}`);
  }
});

test("tolera \\r\\n, inclusive partido entre pedaços", () => {
  const expected = decodeAll([streamOk]);
  assert.deepEqual(decodeAll([streamOkCrlf]), expected);
  for (let size = 1; size <= 25; size++) {
    assert.deepEqual(decodeAll(chunk(streamOkCrlf, size)), expected, `pedaços de ${size}`);
  }
});

test("une várias linhas data com \\n", () => {
  const frames = decodeAll(["event: token\ndata: a\ndata: b\n\n"]);
  assert.deepEqual(frames, [{ event: "token", data: "a\nb" }]);
});

test("ignora comentários, campos desconhecidos e quadros sem data", () => {
  const frames = decodeAll([": keep-alive\n\nid: 7\nretry: 10\nevent: x\n\nevent: token\n: nota\ndata: {}\n\n"]);
  assert.deepEqual(frames, [{ event: "token", data: "{}" }]);
});

test("sem event: o nome padrão é message", () => {
  assert.deepEqual(decodeAll(["data: oi\n\n"]), [{ event: "message", data: "oi" }]);
});

test("quadro incompleto no fim do corpo é descartado", () => {
  assert.deepEqual(decodeAll(["event: token\ndata: {\"text\":\"a\"}"]), []);
});
