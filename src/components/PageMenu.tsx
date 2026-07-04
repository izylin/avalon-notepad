import type { Screen } from "@/lib/game";

export function PageMenu({ onClose, onJump }: { onClose: () => void; onJump: (screen: Screen) => void }) {
  const items: { screen: Screen; title: string; desc: string }[] = [
    { screen: "home", title: "首页", desc: "开始新局、继续存档、快速看规则" },
    { screen: "setup", title: "新开一局", desc: "玩家人数、角色、任务人数和首轮队长" },
    { screen: "record", title: "对局战况", desc: "组队、投票、任务结算的主记录页" },
    { screen: "rules", title: "规则介绍", desc: "完整规则和角色能力说明" },
    { screen: "notes", title: "笔记", desc: "记录身份推测、发言和复盘" },
    { screen: "assassinate", title: "刺杀环节", desc: "蓝方三杀后，记录刺客刺杀是否成功" },
    { screen: "result", title: "本局结算", desc: "任务回顾和胜负结果" }
  ];

  return (
    <div className="page-menu-backdrop" role="dialog" aria-modal="true" aria-label="页面菜单">
      <div className="page-menu">
        <div className="page-menu-head">
          <div>
            <strong>页面菜单</strong>
            <span>原型页面可直接跳转查看</span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">×</button>
        </div>
        <div className="page-menu-list">
          {items.map((item) => (
            <button key={item.screen} className="page-menu-item" onClick={() => onJump(item.screen)}>
              <strong>{item.title}</strong>
              <span>{item.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
