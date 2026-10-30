import { Component, type ErrorInfo, type ReactNode } from "react";
import { toUserError } from "../lib/errors.ts";
import { ErrorPanel } from "./ErrorPanel.tsx";

interface Props {
  children: ReactNode;
}
interface State {
  failed: boolean;
}

/** Limite de erro por seção: uma falha de renderização derruba só a própria seção, com nova tentativa. */
export class SectionBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Sem log de conteúdo: nada de dados de conversa fora da tela.
  }

  render(): ReactNode {
    if (this.state.failed) {
      return (
        <ErrorPanel
          error={toUserError({ source: "client", kind: "unexpected_response" })}
          onRetry={() => this.setState({ failed: false })}
        />
      );
    }
    return this.props.children;
  }
}
