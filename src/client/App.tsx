import { Editor, type SetNav } from "./components/Editor";
import { Library } from "./components/Library";
import { SetView } from "./components/SetView";
import { useSongStore } from "./state/songStore";

export function App() {
  const [state, actions] = useSongStore();
  const { view } = state;

  if (view.name === "editor") {
    const song = state.songs.find((s) => s.id === view.id);
    if (song) {
      let setNav: SetNav | undefined;
      if (view.setId !== undefined && view.setIndex !== undefined) {
        const set = state.setlists.find((s) => s.id === view.setId);
        if (set) {
          const index = view.setIndex;
          const titleOf = (id: string | undefined) =>
            id === undefined ? null : (state.songs.find((s) => s.id === id)?.title ?? null);
          setNav = {
            setName: set.name,
            prevTitle: titleOf(set.songIds[index - 1]),
            nextTitle: titleOf(set.songIds[index + 1]),
            onPrev: () => actions.openInSet(set.id, index - 1),
            onNext: () => actions.openInSet(set.id, index + 1),
          };
        }
      }
      const backToSet = view.setId;
      return (
        <Editor
          song={song}
          onBack={backToSet !== undefined ? () => actions.openSet(backToSet) : actions.close}
          onChange={actions.replaceSong}
          setNav={setNav}
        />
      );
    }
  }

  if (view.name === "set") {
    const set = state.setlists.find((s) => s.id === view.id);
    if (set) {
      return (
        <SetView
          set={set}
          songs={state.songs}
          onBack={actions.close}
          onRename={actions.renameSet}
          onDelete={actions.deleteSet}
          onAdd={actions.addToSet}
          onRemoveAt={actions.removeFromSet}
          onMove={actions.moveInSet}
          onOpenAt={actions.openInSet}
        />
      );
    }
  }

  return (
    <Library
      songs={state.songs}
      setlists={state.setlists}
      onCreate={actions.createSong}
      onOpen={actions.open}
      onRename={actions.rename}
      onDelete={actions.remove}
      onImport={actions.importSong}
      onCreateSet={actions.createSet}
      onOpenSet={actions.openSet}
      onImportSetlists={actions.importSetlists}
    />
  );
}
