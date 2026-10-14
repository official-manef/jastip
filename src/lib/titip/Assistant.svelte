<script lang="ts">
  /**
   * Asisten TITIPIN: chat + function calling. Tool dijalankan di klien (`tools.ts`)
   * sehingga perubahan langsung tampil di meja hitung dan halaman lain.
   */
  import { authedFetch, session } from "./session.svelte";
  import { aiError, aiSettings, loadAiSettings } from "./ai-settings.svelte";
  import { TOOL_DEFS, runTool, summarize } from "./tools";
  import type { AiMessage, AiToolCall } from "./ai";

  type Bubble = { role: "user" | "assistant"; content: string; note?: string };

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

<section class="mx-auto flex h-[calc(100dvh-9rem)] max-w-3xl flex-col">
  <header class="flex items-baseline justify-between gap-3">
    <div>
      <p class="text-sm font-medium tracking-wide text-primary uppercase">Asisten</p>
      <h1 class="mt-1 font-display text-4xl italic">Tanya & ubah</h1>
    </div>
    {#if aiSettings.serverKey === "env"}
      <span class="rounded-full border border-border px-3 py-1 text-xs text-muted">key server</span>
    {:else}
      <a href="/pengaturan" class="text-xs text-primary underline">isi API key</a>
    {/if}
  </header>
  <p class="mt-2 text-sm text-muted">Asisten bisa langsung mengubah meja hitung, titipan, dan peran lewat tool. Saran omzet = proyeksi.</p>

  <ul class="mt-4 flex-1 space-y-3 overflow-y-auto pr-1">
    {#each bubbles as bub, i (i)}
      <li class="flex {bub.role === 'user' ? 'justify-end' : 'justify-start'}">
        <div class="max-w-[85%] rounded-2xl px-4 py-3 text-sm {bub.role === 'user' ? 'bg-primary text-primary-fg' : 'border border-border bg-surface'}">
          {#if bub.content}<p class="whitespace-pre-wrap break-words">{bub.content}</p>{/if}
          {#if bub.note}<p class="mt-1 text-xs {bub.role === 'user' ? '' : 'text-muted'}">{bub.note}</p>{/if}
        </div>
      </li>
    {:else}
      <li class="rounded-2xl border border-dashed border-line bg-surface px-4 py-8 text-center text-sm text-muted">
        Coba: “set harga per kg jadi 350rb”, “tambah barang Kopi 1 kg 4 pcs tarif 300rb/kg”, “buat titipan serum 0,3 kg ke Turki”.
      </li>
    {/each}
    {#if busy}<li class="text-sm text-muted" role="status">Asisten bekerja…</li>{/if}
  </ul>

  {#if notice}<p class="mt-2 text-sm text-accent" role="status">{notice}</p>{/if}
  {#if !session.pending && !session.user}
    <a href="/masuk" class="mt-3 inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-fg">Masuk untuk memakai asisten</a>
  {:else}
    <form class="mt-3 flex items-end gap-2" onsubmit={kirim}>
      <label class="sr-only" for="asisten-input">Pertanyaan</label>
      <textarea
        id="asisten-input"
        rows="2"
        maxlength="4000"
        bind:value={input}
        placeholder="Tulis permintaan…"
        class="min-h-11 flex-1 resize-none rounded-2xl border border-border bg-bg px-3 py-2 text-base outline-none focus:border-primary"
      ></textarea>
      <button type="submit" class="inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-fg disabled:opacity-50" disabled={!canSend || !input.trim()}>
        {busy ? "…" : "Kirim"}
      </button>
    </form>
  {/if}
</section>
