export default function StatCard({ title, value, trend, icon: Icon, color }: any) {
  const colorMap: any = {
    accent: "bg-[#c94a20]",
    blue: "bg-[#1e4fa0]",
    purple: "bg-[#5c38a0]",
    amber: "bg-[#a06010]",
    green: "bg-[#2a7a4f]",
    red: "bg-[#b83020]"
  };

  return (
    <div className="bg-white border border-[#dbd8cf] rounded-xl p-4 relative overflow-hidden shadow-sm">
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${colorMap[color] || colorMap.accent}`} />
      
      {/* 🚨 FIX: Added text-[#0e0e0f] to force the number to be dark */}
      <div className="text-[28px] font-serif leading-none text-[#0e0e0f] font-bold">{value}</div>
      
      <div className="text-[10.5px] font-mono text-[#5a5a64] mt-1 uppercase tracking-tight">{title}</div>
      {trend && <div className="text-[10px] text-[#c8b89a] mt-0.5">{trend}</div>}
      
      {/* Also forced the icon to be dark so it doesn't disappear */}
      {Icon && <Icon className="absolute top-4 right-4 w-5 h-5 text-[#0e0e0f] opacity-10" />}
    </div>
  );
}