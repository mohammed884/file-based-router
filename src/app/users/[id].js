export const handler = (req, res) => {
    try {

        console.log(req.params);
        res.send(`hello user ${req.params.id}`)
    } catch (error) {
        console.log(error);

    }
}