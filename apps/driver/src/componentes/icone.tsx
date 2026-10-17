import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

export type NomeIcone = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Ícone decorativo: o texto ao lado é quem descreve a ação para o leitor de tela. */
export function Icone({ nome, tamanho = 22, cor }: { nome: NomeIcone; tamanho?: number; cor: string }) {
  return (
    <MaterialCommunityIcons
      name={nome}
      size={tamanho}
      color={cor}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
