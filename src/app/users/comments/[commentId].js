
export const handler = (req, res) => {
    res.send(`user comments handler ${req.params.commentId}`)

}