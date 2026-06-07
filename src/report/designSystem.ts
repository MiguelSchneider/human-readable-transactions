// CSS lifted verbatim from the skill's two templates so generated reports match the
// house style exactly. Colour meaning is load-bearing: asset=ink, payment=green, fee=clay, mint=gold.

export const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400;1,9..144,500&family=Public+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">`;

export const CSS_TYPE_B = `
  :root{
    --paper:#F5F1E8;--cream:#FBF9F2;--cream-2:#EFEADD;--ink:#1A2238;--ink-soft:#414B66;--ink-mute:#6B7390;
    --gold:#A8812F;--gold-soft:#C9A85E;--green:#2E6B4F;--green-soft:#E0EBE3;--clay:#9C4A2E;--clay-soft:#F0E2DB;
    --violet:#5B4B8A;--violet-soft:#E7E2F0;
    --line:rgba(26,34,56,0.14);--shadow:0 1px 2px rgba(26,34,56,.05),0 14px 36px -20px rgba(26,34,56,.30);
  }
  *{box-sizing:border-box}
  body{margin:0;color:var(--ink);line-height:1.6;-webkit-font-smoothing:antialiased;font-family:"Public Sans",-apple-system,sans-serif;font-size:16px;
    background:radial-gradient(1100px 560px at 100% -8%,rgba(168,129,47,.08),transparent 60%),
      radial-gradient(820px 460px at -8% 108%,rgba(46,107,79,.07),transparent 55%),var(--paper);}
  .wrap{max-width:880px;margin:0 auto;padding:0 24px}
  header.top{border-bottom:2px solid var(--ink);margin-top:38px;padding-bottom:22px}
  .kicker{font-family:"IBM Plex Mono",monospace;font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);font-weight:600}
  h1{font-family:"Fraunces",serif;font-weight:600;font-size:clamp(31px,5.4vw,50px);line-height:1.04;letter-spacing:-.015em;margin:.3em 0 .2em}
  h1 em{font-style:italic;color:var(--ink-soft)}
  .dek{font-size:18px;color:var(--ink-soft);max-width:62ch;margin:0}
  .meta-row{display:flex;flex-wrap:wrap;gap:6px 22px;margin-top:18px;font-family:"IBM Plex Mono",monospace;font-size:12px;color:var(--ink-mute)}
  .meta-row b{color:var(--ink)}
  .legend{background:var(--ink);color:#EDEAE0;border-radius:13px;padding:20px 24px;margin:26px 0 8px;box-shadow:var(--shadow)}
  .legend h2{font-family:"Fraunces",serif;color:#fff;font-size:18px;margin:0 0 6px;font-weight:600}
  .legend p{margin:5px 0;color:#D2CFC5;font-size:14.5px}
  .legend .roles{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
  .role{font-family:"IBM Plex Mono",monospace;font-size:11px;font-weight:600;padding:3px 9px;border-radius:999px}
  .role.pay,.role.net{background:rgba(224,235,227,.16);color:#bfe0cd}
  .role.fee{background:rgba(240,226,219,.16);color:#e9c3b2}
  .role.share{background:rgba(255,255,255,.12);color:#cfd3df}
  .role.mint{background:rgba(201,168,94,.2);color:var(--gold-soft)}
  .price-note{font-size:13.5px;color:var(--ink-soft);background:rgba(168,129,47,.08);border-left:3px solid var(--gold);padding:11px 16px;border-radius:0 9px 9px 0;margin:14px 0 26px}
  .op{background:var(--cream);border:1px solid var(--line);border-radius:14px;margin:16px 0;box-shadow:var(--shadow);overflow:hidden;border-left:5px solid var(--ink)}
  .op.buy{border-left-color:var(--green)}.op.sell{border-left-color:var(--clay)}.op.mint{border-left-color:var(--gold)}
  .op.dividend{border-left-color:var(--gold)}.op.burn{border-left-color:var(--clay)}.op.transfer{border-left-color:var(--ink-mute)}.op.setup{border-left-color:var(--violet)}
  .op-head{display:flex;align-items:flex-start;gap:14px;padding:16px 20px 8px}
  .opnum{flex:none;width:34px;height:34px;border-radius:50%;background:var(--ink);color:#fff;font-family:"IBM Plex Mono",monospace;font-weight:600;font-size:14px;display:flex;align-items:center;justify-content:center}
  .op-head .h{flex:1;min-width:0}
  .badge{font-family:"IBM Plex Mono",monospace;font-size:10.5px;font-weight:600;padding:2px 8px;border-radius:999px;text-transform:uppercase;letter-spacing:.04em}
  .badge.buy{background:var(--green-soft);color:var(--green)}.badge.sell{background:var(--clay-soft);color:var(--clay)}.badge.mint{background:rgba(168,129,47,.15);color:var(--gold)}
  .badge.dividend{background:rgba(168,129,47,.15);color:var(--gold)}.badge.burn{background:var(--clay-soft);color:var(--clay)}.badge.transfer{background:rgba(26,34,56,.08);color:var(--ink-soft)}.badge.setup{background:var(--violet-soft);color:var(--violet)}
  .op-title{font-family:"Fraunces",serif;font-weight:600;font-size:18px;letter-spacing:-.01em;margin:5px 0 0;line-height:1.25}
  .op-when{flex:none;text-align:right;font-family:"IBM Plex Mono",monospace;font-size:10.5px;color:var(--ink-mute);line-height:1.5}
  .op-body{padding:2px 20px 16px}
  .op-narr{font-size:14.5px;color:var(--ink-soft);margin:8px 0 12px;line-height:1.5}
  .op-narr b{color:var(--ink)}
  table.mv{width:100%;border-collapse:collapse;font-size:13px}
  table.mv th{font-family:"IBM Plex Mono",monospace;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-mute);text-align:left;padding:5px 8px;border-bottom:1.5px solid var(--ink);font-weight:600}
  table.mv td{padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:middle}
  table.mv tr:last-child td{border-bottom:none}
  .mn{font-family:"IBM Plex Mono",monospace;font-size:12px;white-space:nowrap}
  .amt{font-family:"IBM Plex Mono",monospace;font-weight:600;text-align:right;white-space:nowrap}
  .amt.usdc{color:var(--green)}.amt.asset{color:var(--ink)}.amt.feeamt{color:var(--clay)}
  .rl{font-family:"IBM Plex Mono",monospace;font-size:10px;font-weight:600;padding:2px 7px;border-radius:5px;white-space:nowrap}
  .rl.pay,.rl.net{background:var(--green-soft);color:var(--green)}
  .rl.fee{background:var(--clay-soft);color:var(--clay)}
  .rl.share{background:rgba(26,34,56,.09);color:var(--ink)}
  .rl.mint{background:rgba(168,129,47,.15);color:var(--gold)}
  .rl.burn{background:var(--clay-soft);color:var(--clay)}
  .arrow{color:var(--ink-mute);padding:0 3px}
  .prog{font-family:"IBM Plex Mono",monospace;font-size:10px;font-weight:600;padding:2px 7px;border-radius:999px;background:var(--violet-soft);color:var(--violet);margin-right:5px}
  .op-progs{margin:8px 0 2px;display:flex;flex-wrap:wrap;gap:5px;align-items:center}
  .op-progs .lbl{font-family:"IBM Plex Mono",monospace;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-mute)}
  .op-foot{display:flex;flex-wrap:wrap;gap:4px 18px;margin-top:11px;padding-top:9px;border-top:1px dashed var(--line);font-family:"IBM Plex Mono",monospace;font-size:10.5px;color:var(--ink-mute)}
  .op-foot b{color:var(--ink-soft);font-weight:600}
  .op-foot a{color:var(--ink-mute);text-decoration:none;border-bottom:1px dotted var(--ink-mute)}
  .sect-label{font-family:"IBM Plex Mono",monospace;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);font-weight:600;margin:34px 0 2px}
  .sect-h{font-family:"Fraunces",serif;font-weight:600;font-size:23px;margin:2px 0 4px;letter-spacing:-.01em}
  .sect-p{font-size:14.5px;color:var(--ink-soft);margin:0 0 6px}
  footer{margin:40px 0 70px;padding-top:18px;border-top:1px solid var(--line);color:var(--ink-mute);font-size:13px}
  .addr{font-family:"IBM Plex Mono",monospace;font-size:12px;background:var(--cream-2);padding:0 4px;border-radius:4px}
`;

export const CSS_TYPE_A = `
  :root{
    --paper:#F5F1E8;--paper-2:#EFEADD;--ink:#1A2238;--ink-soft:#414B66;--ink-mute:#6B7390;
    --gold:#A8812F;--gold-soft:#C9A85E;--green:#2E6B4F;--green-soft:#E0EBE3;--clay:#9C4A2E;--clay-soft:#F0E2DB;
    --violet:#5B4B8A;--violet-soft:#E7E2F0;
    --line:rgba(26,34,56,0.14);--shadow:0 1px 2px rgba(26,34,56,.06),0 12px 34px -18px rgba(26,34,56,.30);
  }
  *{box-sizing:border-box} html{scroll-behavior:smooth}
  body{margin:0;color:var(--ink);font-family:"Public Sans",-apple-system,sans-serif;font-size:17px;line-height:1.62;
    -webkit-font-smoothing:antialiased;
    background:radial-gradient(1200px 600px at 100% -10%,rgba(168,129,47,.08),transparent 60%),
      radial-gradient(900px 500px at -10% 110%,rgba(46,107,79,.07),transparent 55%),var(--paper);}
  .wrap{max-width:920px;margin:0 auto;padding:0 26px}
  header.masthead{border-bottom:2px solid var(--ink);margin-top:40px;padding-bottom:26px}
  .kicker{font-family:"IBM Plex Mono",monospace;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);font-weight:600}
  h1{font-family:"Fraunces",serif;font-weight:600;font-size:clamp(34px,6vw,58px);line-height:1.02;letter-spacing:-.015em;margin:.34em 0 .18em}
  h1 em{font-style:italic;color:var(--ink-soft)}
  .dek{font-size:19px;color:var(--ink-soft);max-width:60ch;margin:0}
  .meta-row{display:flex;flex-wrap:wrap;gap:8px 26px;margin-top:22px;font-family:"IBM Plex Mono",monospace;font-size:12.5px;color:var(--ink-mute)}
  .meta-row b{color:var(--ink);font-weight:600}
  section{padding:46px 0;border-bottom:1px solid var(--line)}
  .sec-num{font-family:"IBM Plex Mono",monospace;font-size:12px;letter-spacing:.2em;color:var(--gold);font-weight:600;text-transform:uppercase}
  h2{font-family:"Fraunces",serif;font-weight:600;font-size:clamp(25px,3.6vw,34px);line-height:1.1;letter-spacing:-.01em;margin:.25em 0 .5em}
  h3{font-family:"Fraunces",serif;font-weight:600;font-size:21px;margin:1.6em 0 .35em;letter-spacing:-.01em}
  p{margin:.7em 0}.lead{font-size:20px;line-height:1.55}
  .tldr{background:var(--ink);color:#F2EFE6;border-radius:14px;padding:30px 32px;box-shadow:var(--shadow)}
  .tldr .sec-num{color:var(--gold-soft)}.tldr h2{color:#fff;margin-top:.1em}.tldr p{color:#D9D6CC}
  .tldr .big{font-family:"Fraunces",serif;font-size:21px;color:#fff;line-height:1.45}.tldr em{color:var(--gold-soft);font-style:normal}
  .grid{display:grid;gap:14px}.g-2{grid-template-columns:repeat(2,1fr)}
  @media(max-width:720px){.g-2{grid-template-columns:1fr}}
  .card{background:#FBF9F2;border:1px solid var(--line);border-radius:12px;padding:18px 20px}
  .card .term{font-family:"Fraunces",serif;font-weight:600;font-size:18px;margin:0 0 2px;display:flex;align-items:center;gap:9px}
  .card p{margin:.25em 0 0;font-size:15px;color:var(--ink-soft);line-height:1.5}
  .chip{display:inline-block;font-family:"IBM Plex Mono",monospace;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px}
  .chip.asset{background:rgba(26,34,56,.10);color:var(--ink)}.chip.usdc{background:var(--green-soft);color:var(--green)}
  .chip.fee{background:var(--clay-soft);color:var(--clay)}.chip.gold{background:rgba(168,129,47,.15);color:var(--gold)}
  .addr{font-family:"IBM Plex Mono",monospace;font-size:13px;background:var(--paper-2);padding:1px 6px;border-radius:5px;border:1px solid var(--line);white-space:nowrap}
  .cast{display:grid;border:1px solid var(--line);border-radius:12px;overflow:hidden}
  .cast .row{display:grid;grid-template-columns:190px 1fr;gap:18px;padding:16px 20px;border-top:1px solid var(--line);align-items:start}
  .cast .row:first-child{border-top:none}.cast .row:nth-child(odd){background:#FBF9F2}
  .cast .who{font-family:"Fraunces",serif;font-weight:600;font-size:16px}
  .cast .who small{display:block;font-family:"IBM Plex Mono",monospace;font-weight:400;font-size:11.5px;color:var(--ink-mute);margin-top:3px}
  .cast .desc{font-size:15px;color:var(--ink-soft);line-height:1.5}
  @media(max-width:620px){.cast .row{grid-template-columns:1fr;gap:6px}}
  .spec{display:grid;grid-template-columns:repeat(2,1fr);border:1px solid var(--line);border-radius:12px;overflow:hidden}
  .spec div{padding:15px 20px;border-top:1px solid var(--line);border-left:1px solid var(--line)}
  .spec div:nth-child(-n+2){border-top:none}.spec div:nth-child(odd){border-left:none}
  .spec .lab{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-mute)}
  .spec .val{font-family:"Fraunces",serif;font-size:20px;font-weight:600;margin-top:2px}
  .spec .val.mono{font-family:"IBM Plex Mono",monospace;font-size:13px;font-weight:500;word-break:break-all;line-height:1.4}
  @media(max-width:620px){.spec{grid-template-columns:1fr}.spec div{border-left:none}}
  .diagram{background:#FBF9F2;border:1px solid var(--line);border-radius:14px;padding:24px 20px 18px;margin:22px 0;box-shadow:var(--shadow)}
  .diagram svg{width:100%;height:auto;display:block}
  .diagram .cap{font-family:"IBM Plex Mono",monospace;font-size:11.5px;color:var(--ink-mute);text-align:center;margin-top:10px}
  ol.steps{list-style:none;counter-reset:s;padding:0;margin:18px 0}
  ol.steps li{counter-increment:s;position:relative;padding:12px 0 12px 52px;border-top:1px dashed var(--line)}
  ol.steps li:first-child{border-top:none}
  ol.steps li::before{content:counter(s);position:absolute;left:0;top:11px;width:32px;height:32px;border-radius:50%;background:var(--ink);color:#fff;font-family:"IBM Plex Mono",monospace;font-size:14px;font-weight:600;display:flex;align-items:center;justify-content:center}
  ol.steps li .amt{font-family:"IBM Plex Mono",monospace;font-weight:600}
  table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14.5px}
  thead th{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-mute);text-align:left;padding:8px 12px;border-bottom:2px solid var(--ink);font-weight:600}
  tbody td{padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}
  tbody tr:hover{background:#FBF9F2}
  td.num{font-family:"IBM Plex Mono",monospace;text-align:right;white-space:nowrap;font-weight:500}
  td.mono{font-family:"IBM Plex Mono",monospace;font-size:12.5px}
  .tag{font-family:"IBM Plex Mono",monospace;font-size:11px;font-weight:600;padding:2px 7px;border-radius:5px;white-space:nowrap}
  .tag.buy{background:var(--green-soft);color:var(--green)}.tag.sell{background:var(--clay-soft);color:var(--clay)}.tag.mint{background:rgba(168,129,47,.15);color:var(--gold)}
  .tag.dividend{background:rgba(168,129,47,.15);color:var(--gold)}.tag.burn{background:var(--clay-soft);color:var(--clay)}.tag.transfer{background:rgba(26,34,56,.08);color:var(--ink-soft)}.tag.setup{background:var(--violet-soft);color:var(--violet)}
  .prog{display:inline-block;font-family:"IBM Plex Mono",monospace;font-size:11px;font-weight:600;padding:2px 8px;border-radius:999px;background:var(--violet-soft);color:var(--violet)}
  .scroll{overflow-x:auto}
  .callout{border-left:3px solid var(--gold);background:rgba(168,129,47,.07);padding:14px 20px;border-radius:0 10px 10px 0;margin:18px 0;font-size:15.5px;color:var(--ink-soft)}
  .callout b{color:var(--ink)}
  .fee-hero{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin:6px 0 14px}
  .fee-hero .pct{font-family:"Fraunces",serif;font-size:64px;font-weight:600;line-height:1;color:var(--gold)}
  .fee-hero .pct-lab{font-size:16px;color:var(--ink-soft);max-width:42ch}
  .note{font-size:13.5px;color:var(--ink-mute);font-style:italic}
  footer{padding:40px 0 70px;color:var(--ink-mute);font-size:13.5px}
`;
