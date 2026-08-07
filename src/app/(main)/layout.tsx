import ScrollbarAutoHide from "@/components/ScrollbarAutoHide"
import WelcomeModal from "@/components/WelcomeModal"
import FeedbackModal from "@/components/FeedbackModal"
import AuthGate from "@/components/AuthGate"

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <AuthGate>
      <div className="relative">
        <ScrollbarAutoHide />
        <WelcomeModal />
        <FeedbackModal />
        <div className="p-0 sm:pb-10 sm:pt-4 lg:pt-3">
          {children}
        </div>
      </div>
    </AuthGate>
  )
}
