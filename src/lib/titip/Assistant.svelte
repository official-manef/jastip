<script lang="ts">
  /**
   * Asisten Titipin: chat + function calling. Tool dijalankan di klien (`tools.ts`)
   * sehingga perubahan langsung tampil di meja hitung dan halaman lain.
   */
  import { authedFetch, session } from "./session.svelte";
  import { aiError, aiSettings, loadAiSettings } from "./ai-settings.svelte";
  import Ringkas from "./Ringkas.svelte";
  import { TOOL_DEFS, runTool, summarize } from "./tools";
  import type { AiMessage, AiToolCall } from "./ai";

  type Bubble = { role: "user" | "assistant"; content: string; note?: string };

  const field = "field";

  let bubbles = $state<Bubble[]>([]);
  let input = $state("");
  let busy = $state(false);
  let notice = $state("");
  let log: AiMessage[] = [];

  const canSend = $derived(!busy && !!session.user);

  async function callAi(messages: AiMessage[]): Promise<{ content: string; toolCalls: AiToolCall[] }> {
    const res = await authedFetch("/api/ai", {
      method: "POST",
      body: JSON.stringify({
        operation: "chat",
        baseUrl: aiSettings.baseUrl,
        model: aiSettings.model,
        apiKey: aiSettings.apiKey,
        messages,
        tools: TOOL_DEFS,
      }),
    });
    const data = (await res.json()) as { content?: string; toolCalls?: AiToolCall[]; error?: string };
    if (!res.ok) throw new Error(data.error || "provider-error");
    return { content: data.content ?? "", toolCalls: data.toolCalls ?? [] };
  }

  async function kirim(event?: SubmitEvent) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    if (!session.user) { notice = "Masuk dulu untuk memakai asisten."; return; }
    input = "";
    notice = "";
    busy = true;
    bubbles = [...bubbles, { role: "user", content: text }];
    log = [...log, { role: "user", content: text }];
    try {
      for (let step = 0; step < 6; step += 1) {
        const reply = await callAi(log);
        const calls = reply.toolCalls ?? [];
        if (!calls.length) {
          const content = reply.content.trim() || "Selesai.";
          bubbles = [...bubbles, { role: "assistant", content }];
          log = [...log, { role: "assistant", content }];
          break;
        }
        log = [...log, { role: "assistant", content: reply.content, tool_calls: calls }];
        const names: string[] = [];
        for (const call of calls) {
          names.push(call.function.name);
          let args: Record<string, unknown> = {};
          try { args = JSON.parse(call.function.arguments || "{}"); } catch { /* keep empty */ }
          let result: Record<string, unknown>;
          try { result = await runTool(call.function.name, args); }
          catch (err) { result = { error: err instanceof Error ? err.message : "gagal" }; }
          log = [...log, { role: "tool", tool_call_id: call.id, content: summarize(call.function.name, result) }];
        }
        bubbles = [...bubbles, { role: "assistant", content: reply.content.trim(), note: `Tool: ${names.join(", ")}` }];
      }
    } catch (err) {
      notice = aiError(err instanceof Error ? err.message : undefined);
    } finally {
      busy = false;
    }
  }

  $effect(() => { void loadAiSettings(); });
</script>

<section class="flex h-[calc(100dvh-9rem)] max-w-[42rem] flex-col">
  <header data-rise style="--i: 0">
    <h1>Tanya & ubah</h1>
    <p class="mt-3 text-body">
      Asisten bisa langsung mengubah meja hitung, titipan, dan peran lewat tool. Saran omzet = proyeksi.
      {#if aiSettings.serverKey === "env"}
        Key server aktif.
      {:else}
        <a class="link" href="/pengaturan">Isi API key</a> dulu.
      {/if}
    </p>
    <div class="mt-4" data-reveal>
      <Ringkas compact />
    </div>
  </header>

  <ul class="mt-6 flex-1 space-y-3 overflow-y-auto pr-1" data-reveal>
    {#each bubbles as bub, i (i)}
      <li class="flex {bub.role === 'user' ? 'justify-end' : 'justify-start'}">
        <div class="max-w-[85%] rounded p-4 text-body {bub.role === 'user' ? 'bg-primary text-primary-fg' : 'bg-surface'}">
          {#if bub.content}<p class="whitespace-pre-wrap break-words">{bub.content}</p>{/if}
          {#if bub.note}<p class="mt-2 text-small {bub.role === 'user' ? '' : 'text-muted'}">{bub.note}</p>{/if}
        </div>
      </li>
    {:else}
      <li class="panel p-6 text-body text-muted">
        Coba: “set harga per kg jadi 350rb”, “tambah barang Kopi 1 kg 4 pcs tarif 300rb/kg”, “buat titipan serum 0,3 kg ke Turki”.
      </li>
    {/each}
    {#if busy}<li class="text-body text-muted" role="status">Asisten bekerja…</li>{/if}
  </ul>

  {#if notice}<p class="mt-3 text-body text-accent" role="status">{notice}</p>{/if}
  {#if !session.pending && !session.user}
    <a href="/masuk" class="btn mt-4">Masuk untuk memakai asisten</a>
  {:else}
    <form class="mt-4 flex items-end gap-2" onsubmit={kirim}>
      <label class="sr-only" for="asisten-input">Pertanyaan</label>
      <textarea
        id="asisten-input"
        rows="2"
        maxlength="4000"
        bind:value={input}
        placeholder="Tulis permintaan…"
        class="{field} flex-1 resize-none py-3"
      ></textarea>
      <button type="submit" class="btn disabled:opacity-50" disabled={!canSend || !input.trim()}>
        {busy ? "…" : "Kirim"}
      </button>
    </form>
  {/if}
</section>
