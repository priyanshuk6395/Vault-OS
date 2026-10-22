import { UploadProvider } from "@/context/UploadProvider";

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return <UploadProvider>{children}</UploadProvider>;
}