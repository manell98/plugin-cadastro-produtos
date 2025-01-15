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

async function uploadImage(imageUrl) {
    const fileName = path.basename(imageUrl); // Extract the file name from the URL

    try {
        // // 1. Download the image from the URL
        // console.log('Downloading image from URL...');
        // const imageResponse = await axios.get(imageUrl, {
        //     responseType: 'arraybuffer', // To handle binary files
        //     headers: {
        //         'Referer': 'https://www.yupoo.com/', // Set the referer to Yupoo
        //     },
        // });
        //
        // // Save the image temporarily on the local system
        // const tempFilePath = path.resolve(`${__dirname}/camisas-temporarias`, fileName);
        // fs.writeFileSync(tempFilePath, imageResponse.data);
        // console.log('Image saved locally:', tempFilePath);

        // 2. Create FormData for the upload
        const formData = new FormData();
        formData.append('file', fs.createReadStream(imageUrl), fileName);

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

const processAlbums = async () => {
    try {
        // Caminho principal dos álbuns
        const mainDir = path.join(__dirname, 'camisas-temporarias', 'fotos_yupoo', 'club-shirts', 'albuns');

        // Função para verificar se é uma imagem (extensões válidas)
        const isImage = (filename) => {
            const extensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp'];
            return extensions.includes(path.extname(filename).toLowerCase());
        };

        // Tamanho máximo e mínimo permitido para as imagens (em bytes)
        const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
        const MIN_SIZE = 10 * 1024; // 10 KB

        // Ler todas as subpastas no diretório principal com metadados
        const albums = fs.readdirSync(mainDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => {
                const albumPath = path.join(mainDir, dirent.name);
                const stats = fs.statSync(albumPath);
                return {
                    name: dirent.name,
                    ctime: stats.ctime, // Data de criação
                    mtime: stats.mtime, // Última modificação
                };
            });

        // Ordenar pastas pela ordem de criação (ctime) ou pela ordem do sistema
        albums.sort((a, b) => a.ctime - b.ctime);

        const objetoImagensAlbuns = [];

        // Percorrer cada subpasta na ordem correta
        albums.forEach(album => {
            const albumPath = path.join(mainDir, album.name);
            const urlsImagens = [];

            // Ler arquivos dentro da subpasta
            const files = fs.readdirSync(albumPath);

            files.forEach(file => {
                if (isImage(file)) {
                    const imagePath = path.join(albumPath, file);
                    const stats = fs.statSync(imagePath);

                    // Verificar se o tamanho da imagem está dentro do limite
                    if (stats.size >= MIN_SIZE && stats.size <= MAX_SIZE) {
                        urlsImagens.push(imagePath);
                    }
                }
            });

            // Adicionar o álbum e suas imagens ao array final
            objetoImagensAlbuns.push({
                album: album.name,
                imagens: urlsImagens,
            });
        });

        return objetoImagensAlbuns;

    } catch (error) {
        console.error('Erro ao processar os álbuns:', error);
    }
};

app.post('/cadastro/produto', async (req, res) => {
    // const retornoAlbunsLocais = await processAlbums();
    //
    // const camisasNovas = req.body;
    //
    // const arrayObjetoFinal = [];
    //
    // camisasNovas.map((camisaNova, indexCamisa) => {
    //     retornoAlbunsLocais.map((objetoRetorno, indexAlbumLocal) => {
    //         if (indexCamisa === indexAlbumLocal) {
    //             arrayObjetoFinal.push({
    //                 nome: camisaNova.nome,
    //                 imagens: objetoRetorno.imagens,
    //                 permalink: camisaNova.permalink,
    //             });
    //         }
    //     })
    // });
    //
    // console.log("arrayObjetoFinal => ", arrayObjetoFinal);
    //
    // res.json(arrayObjetoFinal);

    const idProduto = 780;

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

    const retornoAlbunsLocais = await processAlbums();

    const result = await Promise.all(
        camisasNovas.map(async (camisaNova, indexCamisa) => {
            const arrayImagens = [];

            try {
                // Para cada imagem do álbum correspondente, faça o upload
                const uploadPromises = retornoAlbunsLocais[indexCamisa]?.imagens.map(async (url) => {
                    try {
                        console.log(`Uploading image: ${url}`);
                        const downloadUpload = await uploadImage(url);
                        return downloadUpload || null; // Retorna null se o upload falhar
                    } catch (error) {
                        console.error(`Failed to upload image ${url}:`, error.message);
                        return null;
                    }
                });

                // Aguarda todos os uploads terminarem
                const uploadResults = await Promise.all(uploadPromises || []);

                // Filtra resultados válidos
                const promessasCheias = uploadResults.filter(result => result !== null && result !== undefined);

                arrayImagens.push(...promessasCheias);

                console.log('All uploads completed.');
            } catch (error) {
                console.error('Unexpected error during the upload process:', error.message);
            }

            if (arrayImagens.length > 1) {
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

                await Promise.all(novoArrayVariacoes.map(async (novaVariacao) => {
                    const variacao = {
                        ...novaVariacao,
                        image: arrayImagens[0],
                        manage_stock: false,
                    };

                    await cadastrarCamisa(`products/${idNovoProduto}/variations`, variacao);
                }));

                return { sucesso: true, camisa: camisaNova.nome };
            }

            return { sucesso: false, camisa: camisaNova.nome };
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
