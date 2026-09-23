import { ArrowRight, Headphones } from "lucide-react";

export function HelpPanel() {
  return <section className="help-panel" aria-labelledby="help-title"><div className="help-panel__icon"><Headphones size={25} strokeWidth={1.7} /></div><div><h2 id="help-title">Нужна помощь?</h2><p>Проконсультируйтесь со специалистом по подбору деталей для вашего автомобиля.</p><a className="button button--outline" href="/contacts">Получить консультацию <ArrowRight size={17} /></a></div></section>;
}
