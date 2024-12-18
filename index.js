const express = require('express');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;
const axios = require('axios');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Middleware para processar JSON
app.use(bodyParser.json());

const apiUrl = process.env.apiUrl;
const consumerKey = process.env.consumerKey;
const consumerSecret = process.env.consumerSecret;
const username = process.env.usernameWp;
const password = process.env.passwordWp;

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
        const response = await axios.post(`${apiUrl}/${endpoint}`, dadosProduto, {
            auth: {
                username: consumerKey,
                password: consumerSecret
            },
        });

        return response.data;
    } catch (error) {
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

async function downloadAndUploadImage(imageUrl) {
    const fileName = path.basename(imageUrl); // Extract the file name from the URL

    try {
        // 1. Download the image from the URL
        console.log('Downloading image from URL...');
        const imageResponse = await axios.get(imageUrl, {
            responseType: 'arraybuffer', // To handle binary files
        });

        // Save the image temporarily on the local system
        const tempFilePath = path.resolve(`${__dirname}/camisas-temporarias`, fileName);
        fs.writeFileSync(tempFilePath, imageResponse.data);
        console.log('Image saved locally:', tempFilePath);

        // 2. Create FormData for the upload
        const formData = new FormData();
        formData.append('file', fs.createReadStream(tempFilePath), fileName);

        // 3. Upload the image to WordPress
        console.log('Uploading image to WordPress...');
        const tokenResponse = await axios.post('https://minuto45.com.br/wp-json/jwt-auth/v1/token', {},
            {
                params: {
                    username,
                    password,
                },
            });

        const token = tokenResponse.data.token;


        const uploadResponse = await axios.post('https://minuto45.com.br/wp-json/wp/v2/media', formData, {
            headers: {
                'Authorization': `Bearer ${token}`,
                ...formData.getHeaders(), // Necessary for FormData
            },
        });

        console.log('Image URL on WordPress:', uploadResponse.data.source_url);

        // Clean up local file after upload
        // fs.unlinkSync(tempFilePath);
        return uploadResponse.data;
    } catch (error) {
        console.error(
            'Error downloading or uploading image:',
            error.response ? error.response.data : error.message
        );
        // throw error;
    }
}

app.post('/cadastro/produto', async (req, res) => {
    const idProduto = 898;

    let camisa = await buscarDados(`products/${idProduto}`);

    delete camisa.id;
    delete camisa.images;

    const camisasNovas = req.body;

    const variacoesExistentes = await buscarDados(`products/${idProduto}/variations`);

    const novoArrayVariacoes = [];

    variacoesExistentes.forEach((variacaoExistente) => {
        delete variacaoExistente.id;
        delete variacaoExistente.image;

        novoArrayVariacoes.push(variacaoExistente);
    });

    const result = await Promise.all(
        camisasNovas.map(async (camisaNova) => {
            const imageUrls = camisaNova.imagens;

            const arrayImagens = [];

            for (const url of imageUrls) {
                try {
                    console.log(`Uploading image: ${url}`);
                    const result = await downloadAndUploadImage(url);
                    arrayImagens.push(result);
                } catch (error) {
                    console.error(`Failed to upload image ${url}:`, error.message);
                }
            }

            const camisaEditada = {
                ...camisa,
                name: camisaNova.nome,
                slug: camisaNova.nome,
                permalink: `https://minuto45.com.br/produto/${camisaNova.permalink}`,
                date_created: formatarData(new Date()),
                date_created_gmt: formatarData(new Date()),
                date_modified: formatarData(new Date()),
                date_modified_gmt: formatarData(new Date()),
                exclude_global_add_ons: false,
                images: arrayImagens,
            };

            const produtoCadastrado = await cadastrarCamisa('products', camisaEditada);

            const idNovoProduto = produtoCadastrado.id;

            novoArrayVariacoes.map(async (novaVariacao) => {
                const variacao = {
                    ...novaVariacao,
                    image: arrayImagens[0],
                    manage_stock: false,
                };

                await cadastrarCamisa(`products/${idNovoProduto}/variations`, variacao);
            });

            return produtoCadastrado;
        })
    );

    res.json(result);
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

app.delete('/produto/:id', async (req, res) => {
    try {
        const { id } = req.params;

        await axios.delete(`${apiUrl}/products/${id}`, {
            auth: {
                username: consumerKey,
                password: consumerSecret,
            },
        });

        res.json({
            sucesso: true,
            message: "Produto Deletado"
        }).status(200);
    } catch (error) {
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao deletar produto',
            erro: error.message,
        });
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});
