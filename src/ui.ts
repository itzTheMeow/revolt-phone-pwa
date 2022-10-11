import { writable, type Writable } from "svelte/store";

interface IUI {
  ListServers?: HTMLDivElement;
  ListChannels?: HTMLDivElement;
  ListMessages?: HTMLDivElement;
  pendBottom: boolean;
}
export const UI: IUI = {
  pendBottom: false,
};

export const LIST_COLLAPSED = writable(false);
