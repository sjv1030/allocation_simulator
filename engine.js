/* Browser/Node port of sim_v5.py. No dependencies. */
(function install(root) {
  'use strict';
  const defaults = {pa0:8.5e9,psa0_pct_of_pa:.30,required_psa_pct:.20,shortfall_coverage:.50,
    guarantee_rate:.0425,beir_rate:.0525,risk_free_rate:.0375,bel_growth_rate:null,mcl_growth_rate:null,
    guaranteed_pct_start:.57,n_years:2,n_sims:1000,method:'gbm',block_size_months:12,
    profit_split_shareholder:.10,profit_split_policyholder:.90,periodic_profit_check:true,
    bonus_freq_months:12,random_seed:42};
  const equityWeights=[.20,.25,.30,.35,.40], bondShares=[.60,.70,.80,.90];
  const mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
  function quantile(sorted,p) {const i=(sorted.length-1)*p,j=Math.floor(i);return sorted[j]+(sorted[Math.min(j+1,sorted.length-1)]-sorted[j])*(i-j);}
  function config(input) {
    const c={...defaults,...input};
    for(const k of ['pa0','psa0_pct_of_pa','required_psa_pct','shortfall_coverage','guarantee_rate','beir_rate','risk_free_rate','guaranteed_pct_start','profit_split_shareholder'])
      if(!Number.isFinite(c[k])) throw Error(k+' must be a finite number.');
    if(c.pa0<=0||c.psa0_pct_of_pa<0)throw Error('Starting assets must be positive and starting PSA nonnegative.');
    for(const k of ['required_psa_pct','shortfall_coverage','guaranteed_pct_start','profit_split_shareholder'])if(c[k]<0||c[k]>1)throw Error(k+' must be between 0 and 100%.');
    c.bel_growth_rate=c.bel_growth_rate??c.beir_rate;c.mcl_growth_rate=c.mcl_growth_rate??c.risk_free_rate;
    for(const k of ['guarantee_rate','beir_rate','risk_free_rate','bel_growth_rate','mcl_growth_rate'])if(!Number.isFinite(c[k])||c[k]<=-1||c[k]>1)throw Error(k+' must be above -100% and at most 100%.');
    for(const [k,min,max] of [['n_years',1,50],['n_sims',1,50000],['bonus_freq_months',1,600],['random_seed',0,4294967295]])if(!Number.isInteger(c[k])||c[k]<min||c[k]>max)throw Error(k+' must be an integer from '+min+' to '+max+'.');
    if(c.n_sims*(c.n_years*12+1)>2000000)throw Error('Reduce paths or years: this browser supports up to 2 million simulated path-months per allocation.');
    if(!['gbm','block'].includes(c.method)||![6,9,12].includes(c.block_size_months))throw Error('Invalid simulation method or block length.');
    c.profit_split_policyholder=1-c.profit_split_shareholder;
    return c;
  }
  function stats(hist) {
    if(hist.length<13||hist.some(r=>r.length!==3||r.some(v=>!Number.isFinite(v)||v<=-1)))throw Error('History must contain at least 13 valid three-asset monthly return rows.');
    const mu=[0,1,2].map(j=>mean(hist.map(r=>r[j])));
    const cov=mu.map((_,j)=>mu.map((_,k)=>hist.reduce((s,r)=>s+(r[j]-mu[j])*(r[k]-mu[k]),0)/(hist.length-1)));
    return {mu,cov,assets:['equity_STI','bond_3_5y','bond_10y_plus'].map((asset,j)=>({asset,monthly_mean:mu[j],monthly_vol:Math.sqrt(cov[j][j]),annualized_mean:12*mu[j],annualized_vol:Math.sqrt(12*cov[j][j])}))};
  }
  function random(seed) {let a=seed>>>0;return ()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
  function generate(hist,c) {
    const {mu,cov}=stats(hist),n=c.n_years*12+1,out=new Float64Array(c.n_sims*n*3),rng=random(c.random_seed);
    if(c.method==='block') {
      if(c.block_size_months>=hist.length)throw Error('Block length must be smaller than history.');
      for(let s=0;s<c.n_sims;s++)for(let t=0;t<n;){const start=Math.floor(rng()*(hist.length-c.block_size_months+1));for(let k=0;k<c.block_size_months&&t<n;k++,t++)for(let j=0;j<3;j++)out[(s*n+t)*3+j]=hist[start+k][j];}
    } else {
      const l=Array.from({length:3},()=>[0,0,0]);
      for(let i=0;i<3;i++)for(let j=0;j<=i;j++){let v=cov[i][j];for(let k=0;k<j;k++)v-=l[i][k]*l[j][k];if(i===j&&v<=0)throw Error('Historical covariance is not positive definite.');l[i][j]=i===j?Math.sqrt(v):v/l[j][j];}
      let spare=null;const normal=()=>{if(spare!==null){const z=spare;spare=null;return z;}const r=Math.sqrt(-2*Math.log(1-rng())),angle=2*Math.PI*rng();spare=r*Math.sin(angle);return r*Math.cos(angle);};
      for(let i=0;i<out.length;i+=3){const z=[normal(),normal(),normal()];for(let j=0;j<3;j++)out[i+j]=Math.expm1(Math.log1p(mu[j])-.5*cov[j][j]+l[j].reduce((s,v,k)=>s+v*z[k],0));}
    }
    return out;
  }
  function runPath(raw,s,eq,b10,c,detail=false) {
    const n=c.n_years*12,nSim=n+1,b=[eq,(1-eq)*(1-b10),(1-eq)*b10].map(w=>w*c.pa0);
    let psa=c.pa0*c.psa0_pct_of_pa,pl=c.pa0,bel=c.pa0,mcl=c.pa0*c.guaranteed_pct_start;
    let pending=null,growth=1,totalInjection=0,cumulative=0,anyShort=false,anyInjection=false,anyPsaOnly=false,anyDraw=false,allShort=true,earlierInjection=false,finalInjection=false;
    const rows=[],wealth=[],g=Math.pow(1+c.guarantee_rate,1/12),bg=Math.pow(1+c.bel_growth_rate,1/12),mg=Math.pow(1+c.mcl_growth_rate,1/12);
    for(let t=0;t<nSim;t++) {
      let paOpen=b.reduce((s,v)=>s+v,0),injected=0,drawn=0,skimmed=0,reset=null,resetDriver=null,liabilitySetsReset=null;
      if(pending){injected=pending.injection;drawn=pending.draw;skimmed=pending.cut;const net=drawn+injected-skimmed,safe=paOpen>0?paOpen:1;for(let j=0;j<3;j++)b[j]+=net*b[j]/safe;psa+=skimmed-drawn;paOpen=b.reduce((s,v)=>s+v,0);pl=Math.max(paOpen,pending.pvBel,pending.pvMcl);reset=pl;liabilitySetsReset=pl>paOpen;resetDriver=!liabilitySetsReset?'PA':pending.pvBel===pending.pvMcl?'PV BEL / PV MCL':pending.pvBel>pending.pvMcl?'PV BEL':'PV MCL';pending=null;}
      pl*=g;for(let j=0;j<3;j++)b[j]*=1+raw[(s*nSim+t)*3+j];const pa=b.reduce((s,v)=>s+v,0),ret=pa/(paOpen>0?paOpen:1)-1;bel*=bg;mcl*=mg;
      if(![pa,pl,bel,mcl,psa,ret].every(Number.isFinite))throw Error('Numerical overflow; reduce the horizon or rates.');
      if(t<n)growth*=1+ret;
      const month=t+1,check=month<=n&&(month===n||(c.periodic_profit_check&&month%c.bonus_freq_months===0));
      let cp={PV_BEL_at_checkpoint:null,PV_MCL_at_checkpoint:null,profit_at_checkpoint:null,shortfall_amount:null,covered_shortfall:null,uncovered_shortfall:null,cumulative_uncovered_shortfall:null,shareholder_cut_decided:null,PSA_draw_decided:null,TM_injection_decided:null};
      if(check) {
        const profit=pa-pl,cut=profit>0?c.profit_split_shareholder*profit:0,sf=Math.max(-profit,0),covered=c.shortfall_coverage*sf;
        const floor=c.required_psa_pct*(pa-cut),draw=Math.min(covered,Math.max(psa-floor,0)),injection=covered-draw,uncovered=sf-draw-injection;
        cumulative+=uncovered;totalInjection+=injection;anyShort||=sf>0;anyInjection||=injection>0;anyPsaOnly||=sf>0&&injection===0&&draw>0;anyDraw||=draw>0;allShort&&=sf>0;
        if(month===n)finalInjection=injection>0;else earlierInjection||=injection>0;
        pending={cut,draw,injection,pvBel:bel/(1+c.beir_rate),pvMcl:mcl/(1+c.risk_free_rate)};
        cp={PV_BEL_at_checkpoint:pending.pvBel,PV_MCL_at_checkpoint:pending.pvMcl,profit_at_checkpoint:profit,shortfall_amount:sf,covered_shortfall:covered,uncovered_shortfall:uncovered,cumulative_uncovered_shortfall:cumulative,shareholder_cut_decided:cut,PSA_draw_decided:draw,TM_injection_decided:injection};
      }
      if(detail)rows.push({month,PA:pa,PL:pl,BEL:bel,MCL:mcl,PA_open_after_capital:paOpen,PL_reset_before_monthly_drift:reset,PL_reset_driver:resetDriver,liability_sets_PL_reset:liabilitySetsReset,PA_return:ret,PSA:psa,PSA_pct_PA:pa?psa/pa:null,equity_weight:pa?b[0]/pa:null,bond_3_5y_weight:pa?b[1]/pa:null,bond_10y_plus_weight:pa?b[2]/pa:null,guaranteed_rate_annual:c.guarantee_rate,beir_rate:c.beir_rate,risk_free_rate:c.risk_free_rate,shortfall_coverage:c.shortfall_coverage,is_checkpoint:check,TM_injection_applied_this_month:injected,PSA_draw_applied_this_month:drawn,shareholder_cut_applied_this_month:skimmed,...cp,running_cumulative_uncovered_shortfall:cumulative});
      if(detail)wealth.push(pa/c.pa0);
    }
    return {cagr:Math.pow(growth,1/c.n_years)-1,terminal_cum_return:growth-1,no_shortfall:!anyShort,psa_only_covered:anyPsaOnly,injection_occurred:anyInjection,total_injections:totalInjection,cumulative_uncovered:cumulative,categories:[!anyShort,earlierInjection&&!finalInjection,anyDraw&&!anyInjection,allShort],rows,wealth};
  }
  function scenario(raw,eq,b10,c) {
    const cagrs=[],terminals=[],examples=[null,null,null,null],sample=[];let no=0,psa=0,inj=0,amount=0,unc=0,below=0;
    for(let s=0;s<c.n_sims;s++){const p=runPath(raw,s,eq,b10,c);cagrs.push(p.cagr);terminals.push(p.terminal_cum_return);no+=p.no_shortfall;psa+=p.psa_only_covered;inj+=p.injection_occurred;amount+=p.total_injections;unc+=p.cumulative_uncovered;below+=p.cagr<c.guarantee_rate;let detailed;
      for(let k=0;k<4;k++)if(p.categories[k]&&examples[k]===null){detailed??=runPath(raw,s,eq,b10,c,true);examples[k]={sim_index:s,rows:detailed.rows};}
      if(s<25){detailed??=runPath(raw,s,eq,b10,c,true);sample.push(detailed.wealth);}}
    const sorted=[...cagrs].sort((a,b)=>a-b);
    return {summary:{equity_weight:eq,bond_10y_plus_share:b10,bond_3_5y_share:1-b10,mean_CAGR:mean(cagrs),median_CAGR:quantile(sorted,.5),p05_CAGR:quantile(sorted,.05),p95_CAGR:quantile(sorted,.95),pct_paths_below_guarantee:below/c.n_sims,pct_paths_no_shortfall:no/c.n_sims,pct_paths_psa_only:psa/c.n_sims,pct_paths_injection:inj/c.n_sims,mean_injection_amount:amount/c.n_sims,mean_cumulative_uncovered_shortfall:unc/c.n_sims},cagrs,terminals,examples,sample};
  }
  const api={defaults,equityWeights,bondShares,mean,quantile,config,stats,random,generate,runPath,scenario};
  api.workerSource='('+install.toString()+')(self);';
  if(typeof module!=='undefined')module.exports=api;else root.SimEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
