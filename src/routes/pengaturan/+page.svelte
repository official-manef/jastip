<script lang="ts">
  import { onMount } from "svelte";
  import { DEFAULT_AI_BASE_URL, DEFAULT_AI_MODEL } from "../../lib/titip/ai";
  import { aiError, aiSettings, loadAiSettings, saveAiSettings } from "../../lib/titip/ai-settings.svelte";
  import { authedFetch, loadMe, session } from "../../lib/titip/session.svelte";
  const control = "min-h-11 w-full rounded-xl border border-border bg-bg px-3 text-base outline-none focus:border-primary";
  let prompt = $state("");
  let models = $state<string[]>([]);
  let answer = $state("");
  let notice = $state("");
  let busy = $state(false);

  onMount(() => {
    void loadMe();
    void loadAiSettings();
  });

  function save() {
    try {
      const url = new URL(aiSettings.baseUrl.trim());
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error();
      aiSettings.baseUrl = aiSettings.baseUrl.trim();
      aiSettings.model = aiSettings.model.trim();
      saveAiSettings();
      notice = "URL dan model tersimpan di perangkat ini. API key hanya dipakai selama halaman terbuka.";
    } catch { notice = "Gunakan URL HTTPS yang valid tanpa kredensial."; }
  }

  async function send(operation: "models" | "chat") {
    if (busy) return;
    busy = true;
    notice = "";
    if (operation === "chat") answer = "";
    try {
      const res = await authedFetch("/api/ai", {
        method: "POST",
        body: JSON.stringify({
          baseUrl: aiSettings.baseUrl,
          model: aiSettings.model,
          apiKey: aiSettings.apiKey,
          prompt,
          operation,
        }),
      });
      const data = (await res.json()) as { models?: string[]; content?: string; error?: string };
      if (!res.ok) { notice = aiError(data.error); return; }
      if (operation === "models") {
        models = data.models ?? [];
        notice = models.length ? `${models.length} model tersedia. Pilih ID persis dari daftar.` : "Penyedia belum mengembalikan model.";
      } else answer = data.content ?? "";
    } catch { notice = "Permintaan belum berhasil. Periksa koneksi Anda."; }
    finally { busy = false; }
  }
</script>

<section class="mx-auto max-w-2xl">
  <p class="text-sm font-medium tracking-wide text-primary uppercase">Pengaturan</p>
  <h1 class="mt-1 font-display text-4xl italic">AI & model</h1>
  <p class="mt-3 text-muted">
    Operasikan penyedia lewat server. Kalau admin sudah menaruh <code>AI_API_KEY</code> di env, kamu bisa langsung pakai asisten tanpa mengisi key.
  </p>

  {#if aiSettings.serverKey === "env"}
    <p class="mt-4 rounded-2xl border border-border bg-surface px-4 py-3 text-sm">
      <span class="font-medium text-primary">Key server aktif.</span>
      Key Anda opsional — mengisi key sendiri akan memakai kuota penyedia Anda, bukan key server.
    </p>
  {:else}
    <p class="mt-4 rounded-2xl border border-dashed border-line bg-surface px-4 py-3 text-sm text-muted">
      Server belum punya <code>AI_API_KEY</code>. Isi key Anda di bawah (BYOK) supaya asisten bisa jalan.
    </p>
  {/if}

  <div class="mt-6 grid gap-4 rounded-2xl border border-border bg-surface p-5 shadow-ticket">
    <label class="grid gap-1 text-sm">API base URL
      <input class={control} type="url" bind:value={aiSettings.baseUrl} onchange={() => models = []} autocomplete="off" maxlength="2048" />
    </label>
    <label class="grid gap-1 text-sm">ID model
      <input class={control} bind:value={aiSettings.model} list="ai-models" maxlength="200" placeholder={DEFAULT_AI_MODEL} />
      <datalist id="ai-models">{#each models as id}<option value={id}></option>{/each}</datalist>
    </label>
    <p class="text-xs text-muted">Default {DEFAULT_AI_MODEL} (tools aktif, tanpa vision). Ambil daftar model untuk memastikan ID persis.</p>
    <button type="button" class="min-h-11 rounded-full border border-border px-4 text-sm" onclick={save}>Simpan URL dan model</button>

    <label class="grid gap-1 text-sm">API key Anda {#if aiSettings.serverKey === "env"}<span class="text-xs text-muted">(opsional)</span>{/if}
      <input class={control} type="password" bind:value={aiSettings.apiKey} autocomplete="off" spellcheck="false" maxlength="4096" />
    </label>
    <p class="text-xs text-muted">Key diteruskan melalui server ke penyedia pilihan Anda, tidak disimpan aplikasi. Biaya mengikuti akun penyedia.</p>
    {#if !session.pending && !session.user}
      <a href="/masuk" class="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 text-sm text-primary-fg">Masuk untuk memakai AI</a>
    {/if}
    <div class="flex flex-wrap gap-2">
      <button type="button" class="min-h-11 rounded-full bg-primary px-4 text-sm text-primary-fg disabled:opacity-50" disabled={busy || !session.user} onclick={() => send("models")}>{busy ? "Memproses…" : "Ambil daftar model"}</button>
      <button type="button" class="min-h-11 rounded-full border border-border px-4 text-sm" onclick={() => { aiSettings.apiKey = ""; answer = ""; notice = "API key dibersihkan dari halaman ini."; }}>Hapus key dari halaman</button>
    </div>
  </div>

  <div class="mt-5 grid gap-3 rounded-2xl border border-border bg-surface p-5">
    <h2 class="font-display text-2xl italic">Uji cepat</h2>
    <p class="text-xs text-muted">Untuk mengubah data, pakai halaman <a class="text-primary underline" href="/asisten">Asisten</a> (function calling). Di sini hanya uji jawaban.</p>
    <label class="grid gap-1 text-sm">Pertanyaan
      <textarea class={control + " py-3"} rows="4" bind:value={prompt} maxlength="4000" placeholder="Apa yang perlu disiapkan untuk trip saya?"></textarea>
    </label>
    <button type="button" class="min-h-11 rounded-full bg-primary px-4 text-sm text-primary-fg disabled:opacity-50" disabled={busy || !aiSettings.model || !prompt.trim() || !session.user} onclick={() => send("chat")}>{busy ? "Memproses…" : "Kirim pertanyaan"}</button>
    {#if answer}<p class="whitespace-pre-wrap break-words text-sm" aria-live="polite">{answer}</p>{/if}
  </div>

  {#if notice}<p class="mt-4 text-sm text-accent" role="status">{notice}</p>{/if}
  <p class="mt-6 text-xs text-muted">Base URL default: {DEFAULT_AI_BASE_URL}</p>
</section>
