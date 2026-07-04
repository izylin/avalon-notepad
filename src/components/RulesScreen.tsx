function RuleList({ short = false }: { short?: boolean }) {
  const items = short ? [
    ["阵营与目标", "分为红蓝两方，蓝方完成三次任务获胜，红方靠破坏任务或事后刺杀梅林翻盘。"],
    ["组队与投票", "队长每轮指定出任务的人选，全员表决是否同意，多数同意才能出发执行任务。"],
    ["任务与结算", "上车玩家暗中提交成功或失败，五局任务里先赢三局的一方决定走向。"]
  ] : [
    ["蓝方角色能力", "梅林知道除了莫德雷德以外的红方牌；派西维尔知道梅林和莫甘娜；忠臣无特殊能力。"],
    ["红方角色能力", "莫德雷德不会被梅林看见，莫甘娜伪装梅林，奥伯伦不参与坏人互认，刺客负责终局刺杀。"],
    ["开局流程", "梅林看到红方，除奥伯伦外的坏人互认，派西维尔看到梅林和莫甘娜。"],
    ["任务轮次", "队长挑选出任务人选，全员表决，多数同意则出发，否则换下一位队长重新组队。"],
    ["任务结算规则", "出任务玩家暗中提交成功或失败。8-10人局第4局需2张失败票才算失败，其余1张即可。"]
  ];
  return <div className="rules">{items.map(([title, body], i) => <div className="rule-row" key={title}><span className="rule-index">{i + 1}</span><div><h4>{title}</h4><p>{body}</p></div></div>)}</div>;
}

export { RuleList };

function RoleRuleList() {
  const groups: { side: string; className: string; items: [string, string][] }[] = [
    {
      side: "蓝方",
      className: "blue",
      items: [
        ["梅林", "知道除了莫德雷德以外的红方牌"],
        ["派西维尔", "知道梅林和莫甘娜，但不知道分别是谁"],
        ["亚瑟的忠臣", "无特殊能力蓝方牌"]
      ]
    },
    {
      side: "红方",
      className: "red",
      items: [
        ["莫德雷德", "梅林看不到他"],
        ["莫甘娜", "假扮梅林，迷惑派西维尔"],
        ["奥伯伦", "看不到其他坏人，其他坏人也看不到他"],
        ["刺客", "在蓝方三次任务成功后，可以刺杀梅林，如成功，红方胜利"],
        ["莫德雷德的爪牙", "无特殊能力红方牌"]
      ]
    }
  ];
  let counter = 0;
  return (
    <div className="rules">
      {groups.map((group) => (
        <div key={group.side} className="rules-group">
          <div className={`rules-label ${group.className}`}>{group.side}</div>
          {group.items.map(([title, body]) => {
            counter += 1;
            return (
              <div className="rule-row" key={title}>
                <span className="rule-index">{counter}</span>
                <div><h4>{title}</h4><p>{body}</p></div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function RulesScreen({ onBack, full = false, rolesOnly = false }: { onBack: () => void; full?: boolean; rolesOnly?: boolean }) {
  return (
    <section className="screen">
      <nav className="app-nav">
        <button className="icon-btn" onClick={onBack}>‹</button>
        <div className="brand">规则介绍</div>
        <span style={{ width: 36 }} />
      </nav>
      {rolesOnly ? <RoleRuleList /> : <RuleList short={!full} />}
    </section>
  );
}
