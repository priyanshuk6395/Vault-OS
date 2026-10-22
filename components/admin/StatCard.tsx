export default function StatCard({ title, value, trend, icon: Icon, color }: any) {
  const colorMap: any = {
    accent: "bg-primary",
    blue: "bg-accent-teal",
    purple: "bg-accent-lavender",
    amber: "bg-accent-amber",
    green: "bg-accent-teal",
    red: "bg-accent-coral"
  };

  return (
    <div className="bg-card text-card-foreground border border-border rounded-lg p-4 relative overflow-hidden shadow-sm">
      <div className={`absolute top-0 left-0 right-0 h-[3px] ${colorMap[color] || colorMap.accent}`} />
      
      <div className="text-[28px] font-serif leading-none text-card-foreground font-bold">{value}</div>
      
      <div className="text-[10.5px] font-mono text-muted-foreground mt-1 uppercase tracking-tight">{title}</div>
      {trend && <div className="text-[10px] text-accent-amber mt-0.5">{trend}</div>}
      
      {/* Also forced the icon to be dark so it doesn't disappear */}
      {Icon && <Icon className="absolute top-4 right-4 w-5 h-5 text-card-foreground opacity-10" />}
    </div>
  );
}