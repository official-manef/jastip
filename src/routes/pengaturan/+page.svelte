<script lang="ts">
  import { onMount } from "svelte";
  import { aiError, aiSettings, loadAiSettings, saveAiSettings } from "../../lib/titip/ai-settings.svelte";
  import Ringkas from "../../lib/titip/Ringkas.svelte";
  import { authedFetch, loadMe, session } from "../../lib/titip/session.svelte";

  const field = "field";
  let prompt = $state("");
  let models = $state<string[]>([]);
  let answer = $state("");
  let notice = $state("");
  let busy = $state(false);

  onMount(() => {
    void loadMe();
    loadAiSettings();
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

<svelte:head><title>AI & model — Titipin</title></svelte:head>

<section>
  <header data-rise style="--i: 0">
    <h1>AI & model</h1>
    <p class="mt-4 text-lead">
      Titipin tidak menyediakan key AI. Isi URL, model, dan API key penyedia Anda sendiri (kompatibel OpenAI). Key hanya dipakai selama halaman terbuka, tidak disimpan.
    </p>
  </header>

  <div class="mt-6" data-reveal>
    <Ringkas compact />
  </div>

  <div class="panel mt-6 grid gap-4 p-5" data-reveal>
    <label class="block">
      <span class="mb-2 block text-small text-muted">API base URL</span>
      <input class={field} type="url" bind:value={aiSettings.baseUrl} onchange={() => models = []} autocomplete="off" maxlength="2048" placeholder="https://penyedia-anda/v1" />
    </label>
    <label class="block">
      <span class="mb-2 block text-small text-muted">ID model</span>
      <input class={field} bind:value={aiSettings.model} list="ai-models" maxlength="200" placeholder="mis. gpt-4o-mini" />
      <datalist id="ai-models">{#each models as id}<option value={id}></option>{/each}</datalist>
    </label>
    <p class="text-small text-muted">Endpoint harus HTTPS publik, kompatibel OpenAI <code>/models</code> dan <code>/chat/completions</code>. Ambil daftar model untuk memastikan ID persis.</p>
    <button type="button" class="btn-quiet" onclick={save}>Simpan URL dan model</button>

    <label class="block">
      <span class="mb-2 block text-small text-muted">API key Anda</span>
      <input class={field} type="password" bind:value={aiSettings.apiKey} autocomplete="off" spellcheck="false" maxlength="4096" />
    </label>
    <p class="text-small text-muted">Key diteruskan melalui server ke penyedia pilihan Anda, tidak disimpan aplikasi. Biaya mengikuti akun penyedia.</p>
    {#if !session.pending && !session.user}
      <a href="/masuk" class="btn">Masuk untuk memakai AI</a>
    {/if}
    <div class="flex flex-wrap gap-2">
      <button type="button" class="btn disabled:opacity-50" disabled={busy || !session.user || !aiSettings.apiKey || !aiSettings.baseUrl} onclick={() => send("models")}>{busy ? "Memproses…" : "Ambil daftar model"}</button>
      <button type="button" class="btn-quiet" onclick={() => { aiSettings.apiKey = ""; answer = ""; notice = "API key dibersihkan dari halaman ini."; }}>Hapus key dari halaman</button>
    </div>
  </div>

  <div class="panel mt-6 grid gap-4 p-5" data-reveal>
    <h2>Uji cepat</h2>
    <p class="text-small text-muted">Untuk mengubah data, pakai halaman <a class="link" href="/asisten">Asisten</a>. Di sini hanya uji jawaban.</p>
    <label class="block">
      <span class="mb-2 block text-small text-muted">Pertanyaan</span>
      <textarea class="{field} py-3" rows="4" bind:value={prompt} maxlength="4000" placeholder="Apa yang perlu disiapkan untuk trip saya?"></textarea>
    </label>
    <button type="button" class="btn disabled:opacity-50" disabled={busy || !aiSettings.model || !aiSettings.apiKey || !prompt.trim() || !session.user} onclick={() => send("chat")}>{busy ? "Memproses…" : "Kirim pertanyaan"}</button>
    {#if answer}<p class="whitespace-pre-wrap break-words text-body" aria-live="polite">{answer}</p>{/if}
  </div>

  {#if notice}<p class="mt-4 text-body text-accent" role="status">{notice}</p>{/if}
</section>
