const express = require('express');
const app = express();
const port = 3000;
const axios = require('axios');
require('dotenv').config();

const apiUrl = process.env.apiUrl;
const consumerKey = process.env.consumerKey;
const consumerSecret = process.env.consumerSecret;

// Função para buscar dados da API
async function buscarDados(endpoint) {
    try {
        const response = await axios.get(`${apiUrl}/${endpoint}`, {
            params: {
                consumer_key: consumerKey,
                consumer_secret: consumerSecret,
                per_page: 100, // Número máximo por página
                page: 1,
            },
        });
        return response.data;
    } catch (error) {
        console.error(`Erro ao buscar ${endpoint}:`, error.message);
        throw error;
    }
}

async function cadastrarCamisa(endpoint, dadosProduto) {
    try {
        console.log("ROTA =>", `${apiUrl}/${endpoint}`)

        const response = await axios.post(`${apiUrl}/${endpoint}`, dadosProduto, {
            auth: {
                username: consumerKey,
                password: consumerSecret
            },
        });

        return response.data;
    } catch (error) {
        // console.log("ERROR =>", error);

        console.error(`Erro ao Cadastrar Produto ${endpoint}:`, error.message);
        throw error;
    }
}

const formatarData = (date) => {
    return date.toISOString().split('.')[0];
};

// Rota para listar todos os produtos
app.get('/produtos', async (req, res) => {
    try {
        const produtos = await buscarDados('products');

        res.json({
            sucesso: true,
            total: produtos.length,
            produtos: produtos.map(produto => ({
                id: produto.id,
                nome: produto.name,
                preco: produto.price,
                estoque: produto.stock_quantity,
            })),
        });
    } catch (error) {
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao buscar os produtos',
            erro: error.message,
        });
    }
});

app.post('/cadastro/produto', async (req, res) => {
    let camisa = await buscarDados("products/898");

    delete camisa.id;

    const camisaEditada = {
        ...camisa,
        name: "Camisa teste via api 999",
        slug: "camisa-teste-via-api 999",
        permalink: "https://minuto45.com.br/produto/camisa-teste-via-api/",
        date_created: formatarData(new Date()),
        date_created_gmt: formatarData(new Date()),
        date_modified: formatarData(new Date()),
        date_modified_gmt: formatarData(new Date()),
        exclude_global_add_ons: false,
    }

    const produtoCadastrado = await cadastrarCamisa('products', camisaEditada);

    const idNovoProduto = produtoCadastrado.id;

    const variacoesExistentes = await buscarDados(`products/898/variations`);

    const novoArrayVariacoes = [];

    variacoesExistentes.forEach((variacaoExistente) => {
        delete variacaoExistente.id;

        novoArrayVariacoes.push(variacaoExistente);
    });

    novoArrayVariacoes.map(async (novaVariacao) => {
        const variacao = {
            ...novaVariacao,
            manage_stock: false,
        };

        await cadastrarCamisa(`products/${idNovoProduto}/variations`, variacao);
    });

    res.json(produtoCadastrado);
});

// Rota para buscar informações de um produto específico pelo ID
app.get('/produto/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const produto = await buscarDados(`products/${id}`);

        let variacoes = [];
        if (produto.type === 'variable') {
            variacoes = await buscarDados(`products/${id}/variations`);
        }

        res.json({
            sucesso: true,
            produto: {
                ...produto,
                variacoes: variacoes.map(variacao => ({
                    id: variacao.id,
                    preco: variacao.price,
                    estoque: variacao.stock_quantity,
                    atributos: variacao.attributes.map(attr => ({
                        nome: attr.name,
                        opcao: attr.option,
                    })),
                }))
            },
        });
    } catch (error) {
        res.status(500).json({
            sucesso: false,
            mensagem: `Erro ao buscar o produto com ID ${id}`,
            erro: error.message,
        });
    }
});

// Rota para listar todas as tags
app.get('/tags', async (req, res) => {
    try {
        const tags = await buscarDados('products/tags');

        res.json({
            sucesso: true,
            total: tags.length,
            tags: tags.map(tag => ({
                id: tag.id,
                nome: tag.name,
                contagem: tag.count, // Quantos produtos usam essa tag
            })),
        });
    } catch (error) {
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao buscar as tags',
            erro: error.message,
        });
    }
});

// Rota para listar todos os atributos
app.get('/atributos', async (req, res) => {
    try {
        const atributos = await buscarDados('products/attributes');

        res.json({
            sucesso: true,
            total: atributos.length,
            atributos: atributos.map(atributo => ({
                id: atributo.id,
                nome: atributo.name,
                slug: atributo.slug,
            })),
        });
    } catch (error) {
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao buscar os atributos',
            erro: error.message,
        });
    }
});

app.get('/categorias', async (req, res) => {
    try {
        const categorias = await buscarDados('products/categories');

        res.json({
            status: true,
            categorias: categorias.map(categoria => ({
                id: categoria.id,
                nome: categoria.name,
                contagem: categoria.count, // Quantos produtos usam essa tag
            })),
        });
    } catch (error) {
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao buscar as tags',
            erro: error.message,
        });
    }
});

app.get('/variacoes/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const variacoes = await buscarDados(`products/${id}/variations`);

        res.json(variacoes);
    } catch (error) {
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao buscar as tags',
            erro: error.message,
        });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
