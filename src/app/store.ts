import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { ToolId } from '../layers/types';

export const PALETTE = [
  '#252a34',
  '#687586',
  '#b83443',
  '#e24b4b',
  '#ef8536',
  '#f6c94d',
  '#70a54a',
  '#35a99c',
  '#3083c5',
  '#5568b6',
  '#8b5cb2',
  '#cc66a1',
  '#8b604c',
  '#573e51',
  '#ffffff',
  '#c9d0d8',
  '#e5b3bd',
  '#ffb9ad',
  '#ffd1a3',
  '#fff1ae',
  '#c9dfab',
  '#b4e5db',
  '#b4d8ef',
  '#c3c9ee',
  '#dec4ef',
  '#f5c3de',
  '#d9bba8',
  '#b9a7c1',
];

interface EditorState {
  tool: ToolId;
  color1: string;
  color2: string;
  colorTarget: 1 | 2;
  size: number;
  filled: boolean;
  zoom: number;
  grid: boolean;
  ruler: boolean;
  sidebar: boolean;
  setTool: (tool: ToolId) => void;
  setColor: (color: string) => void;
  swapColors: () => void;
  set: (
    value: Partial<
      Pick<EditorState, 'colorTarget' | 'size' | 'filled' | 'zoom' | 'grid' | 'ruler' | 'sidebar'>
    >,
  ) => void;
}

/** Apenas configurações leves no React; pixels e gestos ficam fora do ciclo de renderização. */
export const useEditor = create<EditorState>()(
  immer((set) => ({
    tool: 'brush',
    color1: '#3083c5',
    color2: '#ffffff',
    colorTarget: 1,
    size: 6,
    filled: false,
    zoom: 1,
    grid: false,
    ruler: false,
    sidebar: true,
    setTool: (tool) =>
      set((state) => {
        state.tool = tool;
      }),
    setColor: (color) =>
      set((state) => {
        if (state.colorTarget === 1) state.color1 = color;
        else state.color2 = color;
      }),
    swapColors: () =>
      set((state) => {
        [state.color1, state.color2] = [state.color2, state.color1];
      }),
    set: (value) =>
      set((state) => {
        Object.assign(state, value);
      }),
  })),
);
