import { ContainerFake, criarContainerFake } from '@/infrastructure/di/criarContainerFake';
import { Empresa } from '@/domain/entities/Empresa';
import { Endereco } from '@/domain/entities/Endereco';
import { PadraoCemig } from '@/domain/entities/PadraoCemig';
import { Usuario } from '@/domain/entities/Usuario';
import { Leitura, LeituraProps } from '@/domain/entities/Leitura';
import { UUIDv4 } from '@/domain/value-objects/UUIDv4';
import { CNPJ } from '@/domain/value-objects/CNPJ';
import { ValorKwh } from '@/domain/value-objects/ValorKwh';
import { DataLocal } from '@/domain/value-objects/DataLocal';
import { CoordenadasGPS } from '@/domain/value-objects/CoordenadasGPS';
import { PerfilEnum } from '@/domain/enums/PerfilEnum';
import { StatusUsuarioEnum } from '@/domain/enums/StatusUsuarioEnum';

export const SENHA = 'Equinox@2026';

/** Identificadores legíveis e válidos como UUIDv4. */
export const uuid = (n: number): UUIDv4 =>
  new UUIDv4(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);

export const IDS = {
  empresa: uuid(1),
  outraEmpresa: uuid(2),
  endereco: uuid(10),
  outroEndereco: uuid(11),
  padrao: uuid(20),
  tecnico: uuid(30),
  admin: uuid(31),
};

/** 10/03/2026, 12:00 em Brasília — o mesmo instante fixo do container de teste. */
export const AGORA = new Date(Date.UTC(2026, 2, 10, 15));

export function novaEmpresa(id = IDS.empresa, cnpj = '19131243000197'): Empresa {
  return new Empresa({ id, nome: 'Equinox Energia Solar', cnpj: new CNPJ(cnpj), dataCriacao: AGORA });
}

export function novoEndereco(id = IDS.endereco, empresaId = IDS.empresa): Endereco {
  return new Endereco({
    id,
    empresaId,
    apelido: 'Sede administrativa',
    uc: '3001234567',
    coordenadas: new CoordenadasGPS(-19.9191, -43.9386),
    criadoEm: AGORA,
  });
}

export function novoPadrao(
  id = IDS.padrao,
  enderecoId = IDS.endereco,
  numero = '778811',
): PadraoCemig {
  return new PadraoCemig({ id, enderecoId, numero, criadoEm: AGORA });
}

export function novoUsuario(
  sobrescrita: Partial<ConstructorParameters<typeof Usuario>[0]> = {},
): Usuario {
  return new Usuario({
    id: IDS.tecnico,
    empresaId: IDS.empresa,
    nome: 'João da Silva',
    usuario: 'tecnico',
    email: 'tecnico@equinox.dev',
    perfil: PerfilEnum.TECNICO,
    status: StatusUsuarioEnum.ATIVO,
    enderecosVinculados: [IDS.endereco],
    criadoEm: AGORA,
    ...sobrescrita,
  });
}

export function novaLeitura(sobrescrita: Partial<LeituraProps> = {}): Leitura {
  const medidoEm = sobrescrita.medidoEm ?? AGORA;
  return new Leitura({
    id: uuid(100),
    padraoId: IDS.padrao,
    usuarioId: IDS.tecnico,
    valorConsumo: new ValorKwh(11_300),
    fotoLocalUri: 'file:///documents/leituras/100.jpg',
    medidoEm,
    dataLocal: DataLocal.de(medidoEm),
    ...sobrescrita,
  });
}

/**
 * Aparelho já em uso: empresa, endereço, padrão e técnico gravados no banco
 * local (como depois de um primeiro pull), técnico com conta na nuvem e sessão
 * aberta dos dois lados.
 */
export async function aparelhoLogado(): Promise<ContainerFake> {
  const c = criarContainerFake();
  const tecnico = novoUsuario();

  await c.fakes.empresa.salvar(novaEmpresa());
  await c.fakes.endereco.salvar(novoEndereco());
  await c.fakes.padrao.salvar(novoPadrao());
  await c.fakes.usuario.salvar(tecnico);

  c.fakes.autenticacaoRemota.registrarConta(tecnico, SENHA);
  await c.fakes.autenticacaoRemota.entrar(tecnico.email, SENHA);
  await c.fakes.sessao.salvarSessao({
    usuarioId: tecnico.id.value,
    empresaId: IDS.empresa.value,
    nome: tecnico.nome,
    usuario: tecnico.usuario,
    email: tecnico.email,
    perfil: tecnico.perfil,
  });

  return c;
}

/** Registra no dublê de arquivos que a foto da leitura existe no aparelho. */
export function comFotoNoAparelho(c: ContainerFake, leitura: Leitura): void {
  c.fakes.arquivoFoto.salvos.set(leitura.fotoLocalUri, {
    uri: leitura.fotoLocalUri,
    bytes: 300_000,
    largura: 1080,
    altura: 1440,
  });
}
