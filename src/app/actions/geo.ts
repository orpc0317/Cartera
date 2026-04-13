'use server'

import { createClient } from '@/lib/supabase/server'

export type Pais = { codigo: string; nombre: string }
export type Departamento = { pais: string; codigo: string; nombre: string }
export type Municipio = { pais: string; departamento: string; codigo: string; nombre: string }

export async function getPaises(): Promise<Pais[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('cartera')
    .from('t_pais')
    .select('codigo, nombre')
    .order('nombre')
  if (error) throw new Error(`getPaises: ${error.message} (${error.code})`)
  return data as Pais[]
}

export async function getDepartamentos(): Promise<Departamento[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('cartera')
    .from('t_departamento')
    .select('pais, codigo, nombre')
    .order('nombre')
  if (error) throw new Error(`getDepartamentos: ${error.message} (${error.code})`)
  return data as Departamento[]
}

export async function getMunicipios(): Promise<Municipio[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .schema('cartera')
    .from('t_municipio')
    .select('pais, departamento, codigo, nombre')
    .order('nombre')
  if (error) throw new Error(`getMunicipios: ${error.message} (${error.code})`)
  return data as Municipio[]
}
