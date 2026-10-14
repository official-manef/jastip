<script lang="ts">
  import { onMount } from "svelte";
  import { DEFAULT_AI_BASE_URL, DEFAULT_AI_MODEL } from "../../lib/titip/ai";
  import { authedFetch, loadMe, session } from "../../lib/titip/session.svelte";
  const control = "min-h-11 w-full rounded-xl border border-border bg-bg px-3 text-base outline-none focus:border-primary";
  let baseUrl = $state(DEFAULT_AI_BASE_URL);
  let model = $state(DEFAULT_AI_MODEL);
  let apiKey = $state("");
  let prompt = $state("");
  let models = $state<string[]>([]);
  let answer = $state("");
  let notice = $state("");
  let busy = $state(false);

  onMount(() => {
    void loadMe();
    void (async () => {
      try {
        const response = await fetch("/api/ai");
        const defaults = await response.json();
        const saved = JSON.parse(localStorage.getItem("titipin-ai-settings") || "null");
        baseUrl = typeof saved?.baseUrl === "string" ? saved.baseUrl : defaults.baseUrl;
        model = typeof saved?.model === "string" ? saved.model : defaults.model;
      } catch { notice = "Pengaturan belum bisa dimuat; nilai awal tetap tersedia."; }
    })();
  });

  function saveSettings() {
    try {
      const url = new URL(baseUrl.trim());
      if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error();
      localStorage.setItem("titipin-ai-settings", JSON.stringify({ baseUrl: baseUrl.trim(), model: model.trim() }));
      notice = "URL dan model tersimpan di perangkat ini. API key hanya digunakan selama halaman terbuka.";
    } catch { notice = "Gunakan URL HTTPS yang valid tanpa kredensial."; }
  }

  const errors: Record<string, string> = {
    masuk: "Masuk terlebih dahulu untuk memakai AI.",
    "invalid-request": "Isi API key, model, dan pertanyaan dengan benar.",
    "provider-not-allowed": "Endpoint ini belum diizinkan. Admin perlu menambahkan host penyedia sebelum dapat dipakai.",
    "provider-auth": "API key ditolak penyedia. Periksa key dan izin model Anda.",
    "provider-limit": "Kuota atau batas permintaan penyedia tercapai.",
    "provider-error": "Penyedia menolak permintaan. Periksa ID model melalui daftar model.",
    "provider-format": "Respons penyedia belum sesuai format yang didukung.",
    "provider-unreachable": "Penyedia belum dapat dihubungi. Periksa koneksi atau coba lagi.",
  };

  async function send(operation: "models" | "chat") {
    if (busy) return;
    busy = true;
    notice = "";
    if (operation === "chat") answer = "";
    try {
      const response = await authedFetch("/api/ai", { method: "POST", body: JSON.stringify({ baseUrl, model, apiKey, prompt, operation }) });
      const data = await response.json();
      if (!response.ok) { notice = errors[data.error] || "Permintaan belum berhasil. Coba lagi."; return; }
      if (operation === "models") {
        models = data.models;
        notice = models.length ? `${models.length} model tersedia. Pilih ID persis dari daftar.` : "Penyedia belum mengembalikan model.";
      } else answer = data.content;
    } catch { notice = "Permintaan belum berhasil. Periksa koneksi Anda."; }
    finally { busy = false; }
  }
</script>

<section class="mx-auto max-w-2xl">
  <p class="text-sm font-medium tracking-wide text-primary uppercase">Pengaturan</p>
  <h1 class="mt-1 font-display text-4xl italic">AI dengan key sendiri</h1>
  <p class="mt-3 text-muted">Pakai Conextlab atau endpoint kompatibel OpenAI yang telah diizinkan admin. URL dan model bisa diubah.</p>
  <div class="mt-6 grid gap-4 rounded-2xl border border-border bg-surface p-5 shadow-ticket">
    <label class="grid gap-1 text-sm">API base URL
      <input class={control} type="url" bind:value={baseUrl} onchange={() => models = []} autocomplete="off" maxlength="2048" />
    </label>
    <label class="grid gap-1 text-sm">ID model
      <input class={control} bind:value={model} list="ai-models" maxlength="200" />
      <datalist id="ai-models">{#each models as id}<option value={id}></option>{/each}</datalist>
    </label>
    <p class="text-xs text-muted">Nilai awal mengikuti nama yang Anda berikan. Ambil daftar model untuk memastikan ID API yang tepat.</p>
    <button type="button" class="min-h-11 rounded-full border border-border px-4 text-sm" onclick={saveSettings}>Simpan URL dan model</button>
    <label class="grid gap-1 text-sm">API key Anda
      <input class={control} type="password" bind:value={apiKey} autocomplete="off" spellcheck="false" maxlength="4096" />
    </label>
    <p class="text-xs text-muted">Key diteruskan melalui server ke penyedia pilihan Anda dan tidak disimpan oleh aplikasi. Biaya pemakaian mengikuti akun penyedia Anda.</p>
    {#if !session.pending && !session.user}
      <a href="/masuk" class="inline-flex min-h-11 items-center justify-center rounded-full bg-primary px-4 text-sm text-primary-fg">Masuk untuk memakai AI</a>
    {/if}
    <div class="flex flex-wrap gap-2">
      <button type="button" class="min-h-11 rounded-full bg-primary px-4 text-sm text-primary-fg disabled:opacity-50" disabled={busy || !apiKey || !session.user} onclick={() => send("models")}>{busy ? "Memproses…" : "Ambil daftar model"}</button>
      <button type="button" class="min-h-11 rounded-full border border-border px-4 text-sm" onclick={() => { apiKey = ""; answer = ""; notice = "API key dibersihkan dari halaman ini."; }}>Hapus key dari halaman</button>
    </div>
  </div>
  <div class="mt-5 grid gap-3 rounded-2xl border border-border bg-surface p-5">
    <h2 class="font-display text-2xl italic">Tanya asisten</h2>
    <label class="grid gap-1 text-sm">Pertanyaan
      <textarea class={control + " py-3"} rows="4" bind:value={prompt} maxlength="4000" placeholder="Apa yang perlu disiapkan untuk trip saya?"></textarea>
    </label>
    <p class="text-xs text-muted">Jawaban AI adalah saran; angka trip dan aturan resmi tetap perlu diperiksa. Satu permintaan dibatasi 512 token keluaran.</p>
    <button type="button" class="min-h-11 rounded-full bg-primary px-4 text-sm text-primary-fg disabled:opacity-50" disabled={busy || !apiKey || !model || !prompt.trim() || !session.user} onclick={() => send("chat")}>{busy ? "Memproses…" : "Kirim pertanyaan"}</button>
    {#if answer}<p class="whitespace-pre-wrap break-words text-sm" aria-live="polite">{answer}</p>{/if}
  </div>
  {#if notice}<p class="mt-4 text-sm text-accent" role="status">{notice}</p>{/if}
</section>
