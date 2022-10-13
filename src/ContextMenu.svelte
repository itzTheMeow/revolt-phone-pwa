<script lang="ts">
  import type { ThemeSettings } from "util";

  export let position: { left?: number; right?: number; top?: number; bottom?: number };
  export let options: {
    name: string;
    icon: ConstructorOfATypedSvelteComponent;
    onclick: () => any;
  }[];

  const themeSettings: ThemeSettings = JSON.parse(localStorage.getItem("theme") || "{}");
</script>

<div
  class="rounded-md absolute px-2 py-1 select-none"
  style="{Object.entries(position)
    .map((e) => `${e[0]}: ${e[1]}px;`)
    .join('')}background-color:{themeSettings['tooltip']};"
>
  {#each options as opt}
    <div
      class="my-2 mx-1 rounded-sm px-1"
      style="background-color:rgba(255,255,255,0.04);transition:background-color 200ms;"
      on:touchstart={(e) => {
        //@ts-ignore
        e.target.style.backgroundColor = "rgba(255,255,255,0.2)";
      }}
      on:touchend={(e) => {
        //@ts-ignore
        e.target.style.backgroundColor = "rgba(255,255,255,0.04)";
      }}
      on:click={() => opt.onclick()}
    >
      <span class="pointer-events-none flex items-center justify-center">
        <svelte:component this={opt.icon} />
        <div class="font-semibold text-lg mr-1 pointer-events-none">{opt.name}</div>
      </span>
    </div>
  {/each}
</div>
