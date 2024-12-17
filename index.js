const express = require('express');
const app = express();
const port = 3000;
const axios = require('axios');

const apiUrl = '';
const consumerKey = '';
const consumerSecret = '';

// // Dados dos produtos em massa
// const produtos = [
//     {
//         name: 'Produto 1',
//         type: 'simple',
//         regular_price: '29.90',
//         description: 'Descrição do Produto 1',
//         short_description: 'Resumo do Produto 1',
//         categories: [{ id: 15 }],
//         images: [{ src: 'https://link-da-imagem.com/produto1.jpg' }],
//     }
// ];
//
// // Função para cadastrar produtos
// async function cadastrarProdutosEmMassa(produtos) {
//     for (const produto of produtos) {
//         try {
//             const response = await fetch(
//                 `${baseUrl}?consumer_key=${consumerKey}&consumer_secret=${consumerSecret}`,
//                 {
//                     method: 'POST',
//                     headers: {
//                         'Content-Type': 'application/json',
//                     },
//                     body: JSON.stringify(produto),
//                 }
//             );
//
//             const data = await response.json();
//
//             if (response.ok) {
//                 console.log(`✅ Produto "${produto.name}" cadastrado com sucesso!`, data);
//             } else {
//                 console.error(
//                     `❌ Erro ao cadastrar o produto "${produto.name}":`,
//                     data
//                 );
//             }
//         } catch (error) {
//             console.error(`❌ Falha na requisição para "${produto.name}":`, error);
//         }
//     }
// }
//
// // Executa o cadastro
// cadastrarProdutosEmMassa(produtos);

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

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
