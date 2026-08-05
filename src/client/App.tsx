import { Editor } from "./components/Editor";
import { Library } from "./components/Library";
import { useSongStore } from "./state/songStore";

export function App() {
  const [state, actions] = useSongStore();

  if (state.view.name === "editor") {
    const song = state.songs.find((s) => s.id === (state.view as { id: string }).id);
    if (song) {
      return <Editor song={song} onBack={actions.close} onChange={actions.replaceSong} />;
    }
  }

  return (
    <Library
      songs={state.songs}
      onCreate={actions.createSong}
      onOpen={actions.open}
      onRename={actions.rename}
      onDelete={actions.remove}
      onImport={actions.importSong}
    />
  );
}
