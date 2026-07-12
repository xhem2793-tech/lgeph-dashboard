export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="relative">
      <div className="p-0 sm:pb-10 sm:pt-4 lg:pt-3">
        {children}
      </div>
    </div>
  )
}
