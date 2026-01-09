import { PhotoFrame } from "./components/PhotoFrame";
import { Toaster } from "./components/ui/sonner";

export default function App() {
  return (
    <div className="w-full min-h-screen bg-stone-100">
      <PhotoFrame />
      <Toaster />
    </div>
  );
}
